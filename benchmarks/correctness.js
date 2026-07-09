// Functional correctness assertion: runs generated code against lightweight test
// cases per task. Proves "less code" is not "broken code". Spawns python/node
// with the extracted code + appended assertions; returns pass/fail + score.
//
// Metric: `correct` (1 = all checks pass, 0 = at least one fails).
// Unlike loc.js (measurement-only), this one is a gate — a wrong answer is a
// wrong answer regardless of how few lines produced it.

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function correctnessTimeoutMs() {
  const value = Number.parseInt(process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS || '', 10);
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

// Extract fenced code blocks, tagged by language.
function extractBlocks(text) {
  text = String(text || '');
  const matches = [...text.matchAll(/```(\w*)\r?\n([\s\S]*?)```/g)];
  // ponytail: terse models often answer with bare, unfenced code. Treat the whole
  // response as one block so the gate scores the code instead of reporting "no block".
  if (matches.length === 0 && text.trim()) return [{ lang: '', code: text }];
  return matches.map((m) => ({ lang: (m[1] || '').toLowerCase(), code: m[2] }));
}

// Identify which task we're evaluating from vars.task.
function identifyTask(task) {
  const t = task.toLowerCase();
  if (t.includes('email') && t.includes('valid')) return 'email';
  if (t.includes('debounce')) return 'debounce';
  if (t.includes('csv') && t.includes('sum')) return 'csv';
  if (t.includes('countdown') && t.includes('react')) return 'countdown';
  if (t.includes('rate limit') || t.includes('rate-limit')) return 'ratelimit';
  return null;
}

// Run a command, return { ok, stderr }.
function exec(cmd, opts = {}) {
  try {
    execSync(cmd, { timeout: correctnessTimeoutMs(), encoding: 'utf8', stdio: 'pipe', ...opts });
    return { ok: true, stderr: '' };
  } catch (e) {
    return { ok: false, stderr: (e.stderr || e.message || '').slice(0, 500) };
  }
}

// ponytail: probe once at load; macOS and many Linux images ship python3 only.
let pythonCmd;
function python() {
  if (pythonCmd) return pythonCmd;
  for (const cmd of ['python3', 'python']) {
    if (exec(`${cmd} -c "import sys"`).ok) {
      pythonCmd = cmd;
      return pythonCmd;
    }
  }
  pythonCmd = 'python3';
  return pythonCmd;
}

// Write content to a temp file, return the path.
function tmpFile(ext, content) {
  const p = path.join(os.tmpdir(), `ponytail-bench-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(p, content);
  return p;
}

// --- Per-task test harnesses ---

const CHECKS = {
  email(blocks) {
    const code = blocks.find((b) => b.lang === 'python' || b.lang === 'py' || (!b.lang && b.code.includes('def ')));
    if (!code) return { pass: false, reason: 'No Python code block found' };

    // Append assertions that call the generated function by common names.
    const harness = `
${code.code}

# Find the validator function
import sys
fn = None
for name in ['validate_email', 'is_valid_email', 'email_validator', 'is_valid', 'validate']:
    if name in dir() and callable(eval(name)):
        fn = eval(name)
        break

if fn is None:
    # Try any function that takes one arg
    import inspect
    for name, obj in list(globals().items()):
        if callable(obj) and not name.startswith('_'):
            try:
                sig = inspect.signature(obj)
                if len(sig.parameters) == 1:
                    fn = obj
                    break
            except (ValueError, TypeError):
                pass

if fn is None:
    print("FAIL: no validator function found")
    sys.exit(1)

# Test cases
failures = []
if not fn("user@example.com"):
    failures.append("rejected valid: user@example.com")
if not fn("a@b.co"):
    failures.append("rejected valid: a@b.co")
if fn("no-at-sign"):
    failures.append("accepted invalid: no-at-sign")
if fn(""):
    failures.append("accepted invalid: empty string")
if fn("@missing-local.com"):
    failures.append("accepted invalid: @missing-local.com")

if failures:
    print("FAIL: " + "; ".join(failures))
    sys.exit(1)
print("PASS")
`;
    const f = tmpFile('.py', harness);
    const result = exec(`${python()} "${f}"`);
    fs.unlinkSync(f);
    if (result.ok) return { pass: true, reason: 'Email validator passes all checks' };
    return { pass: false, reason: result.stderr || 'Email validator failed' };
  },

  debounce(blocks) {
    const code = blocks.find((b) => b.lang === 'javascript' || b.lang === 'js' || (!b.lang && (b.code.includes('function') || b.code.includes('=>'))));
    if (!code) return { pass: false, reason: 'No JavaScript code block found' };

    const harness = `
${code.code}

// Find the debounce function
const fn = typeof debounce === 'function' ? debounce
  : typeof module !== 'undefined' && typeof module.exports === 'function' ? module.exports
  : null;

if (!fn) {
  console.error("FAIL: no debounce function found");
  process.exit(1);
}

// Test: debounced function should not fire immediately
let callCount = 0;
const debounced = fn(() => { callCount++; }, 50);
debounced();
debounced();
debounced();

if (callCount > 0) {
  console.error("FAIL: debounce fired immediately (should wait)");
  process.exit(1);
}

// Test: should fire after the delay
setTimeout(() => {
  if (callCount !== 1) {
    console.error("FAIL: expected 1 call after delay, got " + callCount);
    process.exit(1);
  }
  console.log("PASS");
}, 120);
`;
    const f = tmpFile('.mjs', harness);
    const result = exec(`node "${f}"`);
    fs.unlinkSync(f);
    if (result.ok) return { pass: true, reason: 'Debounce passes all checks' };
    return { pass: false, reason: result.stderr || 'Debounce failed' };
  },

  csv(blocks) {
    const code = blocks.find((b) => b.lang === 'python' || b.lang === 'py' || (!b.lang && b.code.includes('csv') && b.code.includes('sum')));
    if (!code) return { pass: false, reason: 'No Python code block found' };

    // Create a test CSV and wrap the generated code so it reads it.
    const csvContent = 'name,amount\nAlice,100.5\nBob,200.0\nCharlie,50.5\n';
    const csvPath = tmpFile('.csv', csvContent).replace(/\\/g, '/');

    // The generated code likely reads 'sales.csv'; patch the filename.
    let patched = code.code.replace(/['"]sales\.csv['"]/g, `'${csvPath}'`);
    // Also try open() calls
    patched = patched.replace(/open\(\s*['"]sales\.csv['"]/g, `open('${csvPath}'`);

    const harness = `
import sys, os
os.chdir(r"${path.dirname(csvPath)}")

# Capture print output
import io
_stdout = sys.stdout
sys.stdout = io.StringIO()

try:
${patched.split('\n').map((l) => '    ' + l).join('\n')}
except Exception as e:
    sys.stdout = _stdout
    # If it needs sales.csv in cwd, write it there and retry
    pass

output = sys.stdout.getvalue()
sys.stdout = _stdout

# Check output contains the number 351 (100.5 + 200.0 + 50.5)
# Match as a standalone number (not as substring of e.g. 13510)
import re
if re.search(r'(?<![\\d])351(?:\\.0)?(?![\\d])', output):
    print("PASS")
else:
    # Try running it differently: maybe it defines a function
    print("FAIL: output was: " + repr(output[:200]))
    sys.exit(1)
`;
    const f = tmpFile('.py', harness);
    const result = exec(`${python()} "${f}"`);
    try { fs.unlinkSync(f); } catch (e) {}
    try { fs.unlinkSync(csvPath); } catch (e) {}
    if (result.ok) return { pass: true, reason: 'CSV sum produces correct result (351)' };
    return { pass: false, reason: result.stderr || 'CSV sum failed' };
  },

  countdown(blocks) {
    // React components can't run in bare Node without a bundler. Structural check:
    // the code must contain timer/countdown logic (useState/useEffect/setInterval/setTimeout).
    const code = blocks.find((b) => b.code.includes('ount') || b.code.includes('timer') || b.code.includes('Timer'));
    if (!code) return { pass: false, reason: 'No countdown component found' };

    const src = code.code;
    const hasState = /useState|useReducer|this\.state/.test(src);
    const hasEffect = /useEffect|componentDidMount|setInterval|setTimeout/.test(src);
    const hasDecrement = /- 1|-= 1|prev - 1|count - 1|seconds - 1|time - 1/.test(src);

    const failures = [];
    if (!hasState) failures.push('no state management (useState/useReducer)');
    if (!hasEffect) failures.push('no timer setup (useEffect/setInterval/setTimeout)');
    if (!hasDecrement) failures.push('no countdown decrement logic');

    if (failures.length === 0) return { pass: true, reason: 'Countdown has required structure' };
    return { pass: false, reason: 'Missing: ' + failures.join(', ') };
  },

  ratelimit(blocks) {
    const code = blocks.find((b) => b.lang === 'python' || b.lang === 'py' || (!b.lang && (b.code.includes('rate') || b.code.includes('limit'))));
    if (!code) return { pass: false, reason: 'No Python code block found' };

    // Structural check for rate limiting: must have some form of counter/time tracking.
    const src = code.code;
    const hasTimeTracking = /time\.|datetime|asyncio/.test(src);
    const hasLimitLogic = /limit|max_requests|rate|429|Too Many|HTTPException|RateLimiter/.test(src);
    const hasFastAPI = /fastapi|FastAPI|app\s*=|@app\./.test(src);

    const failures = [];
    if (!hasLimitLogic) failures.push('no rate limit logic');
    if (!hasFastAPI) failures.push('no FastAPI usage');

    if (failures.length === 0) return { pass: true, reason: 'Rate limiter has required structure' };
    return { pass: false, reason: 'Missing: ' + failures.join(', ') };
  },
};

// --- Main assertion entry point ---

module.exports = (output, context) => {
  const task = identifyTask(context.vars.task || '');
  if (!task) {
    return { pass: true, score: 1, reason: 'Unknown task, skipped correctness check' };
  }

  const blocks = extractBlocks(String(output || ''));
  if (blocks.length === 0) {
    return { pass: false, score: 0, reason: 'No code blocks in output' };
  }

  const check = CHECKS[task];
  const result = check(blocks);
  return {
    pass: result.pass,
    score: result.pass ? 1 : 0,
    reason: result.reason,
  };
};
