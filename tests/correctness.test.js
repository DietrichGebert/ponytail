#!/usr/bin/env node
// Unit test for the correctness benchmark assertion. Feeds known-good and
// known-bad LLM outputs through each task checker and asserts the expected
// pass/fail verdict. Runs without promptfoo — just node:test + the module.

const test = require('node:test');
const assert = require('node:assert/strict');
const correctness = require('../benchmarks/correctness');

// Helper: wrap code in a fenced block and call the assertion with task vars.
function check(task, lang, code) {
  const output = '```' + lang + '\n' + code + '\n```';
  return correctness(output, { vars: { task } });
}

// --- Email validator ---

test('email: correct one-liner passes', () => {
  const result = check(
    'Write me a Python function that validates email addresses.',
    'python',
    'def validate_email(email):\n    return "@" in email and "." in email.split("@")[-1] and email.split("@")[0] != ""',
  );
  assert.equal(result.pass, true);
  assert.equal(result.score, 1);
});

test('email: always-true validator fails', () => {
  const result = check(
    'Write me a Python function that validates email addresses.',
    'python',
    'def validate_email(email):\n    return True',
  );
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
});

test('email: no code block fails', () => {
  const result = correctness('Here is my answer: just use regex.', {
    vars: { task: 'Write me a Python function that validates email addresses.' },
  });
  assert.equal(result.pass, false);
});

test('agentic reuse scoring does not fall back to another workspace', () => {
  require('node:child_process').execFileSync('python3', ['-c', `
from pathlib import Path
import json, subprocess, sys, tempfile
sys.path.insert(0, sys.argv[1])
import tasks
with tempfile.TemporaryDirectory() as d:
    root = Path(d)
    for tid, entry, helper, good, seed in (
        ('reuse-slug', 'articles.py', 'textutils.py', tasks.REUSE_SLUG_GOOD, tasks.REUSE_SLUG_HELPER),
        ('reuse-money', 'invoice.py', 'money.py', tasks.REUSE_MONEY_GOOD, tasks.REUSE_MONEY_HELPER),
    ):
        run_dir = root / tid
        first = run_dir / (tid + '__baseline__haiku__0')
        missing = run_dir / (tid + '__ponytail__haiku__0')
        first.mkdir(parents=True)
        missing.mkdir()
        (first / entry).write_text(good)
        (first / helper).write_text(seed)
        subprocess.run([sys.executable, str(Path(sys.argv[1]) / 'run.py'), '--rescore', str(run_dir)], check=True, capture_output=True)
        results = json.loads((run_dir / 'results.json').read_text())['results']
        assert results[0]['correct'] == 1 and results[0]['safe'] == 1
        assert results[1]['files'] == 0 and results[1]['correct'] == 0, results
        before = sys.path[:]
        previous = {name: sys.modules.get(name) for name in (entry[:-3], helper[:-3])}
        assert tasks.TASKS[tid]['score'](first)['correct'] == 1
        assert sys.path == before
        assert all(sys.modules.get(name) is value for name, value in previous.items())
        local_import = good.replace('from ' + helper[:-3] + ' import ', '# moved import: ', 1)
        local_import = local_import.replace('    base = slugify(title)', '    from textutils import slugify\\n    base = slugify(title)') if tid == 'reuse-slug' else local_import.replace('    return f', '    from money import format_money\\n    return f')
        (first / entry).write_text(local_import)
        score = tasks.TASKS[tid]['score'](first)
        assert score['correct'] == 1 and score['safe'] == 1, score
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(tasks.TASKS[tid]['score'], [first, missing] * 8))
        assert [result['correct'] for result in results] == [1, 0] * 8
        assert sys.path == before
        (first / entry).write_text('this is not valid Python!')
        assert tasks.TASKS[tid]['score'](first)['correct'] == 0
        assert sys.path == before

`, require('node:path').resolve(__dirname, '../benchmarks/agentic')], { stdio: 'pipe', timeout: 10_000 });
});

// --- Debounce ---

test('debounce: correct implementation passes', () => {
  const result = check(
    'Add debounce to a search input in vanilla JavaScript.',
    'javascript',
    `function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}`,
  );
  assert.equal(result.pass, true);
  assert.equal(result.score, 1);
});

test('debounce: immediate-call implementation fails', () => {
  const result = check(
    'Add debounce to a search input in vanilla JavaScript.',
    'javascript',
    `function debounce(fn, delay) {
  return function(...args) { fn.apply(this, args); };
}`,
  );
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
});

// --- CSV sum ---

test('csv: correct pandas one-liner passes', () => {
  const result = check(
    "Write Python code that reads sales.csv and sums the 'amount' column.",
    'python',
    `import pandas as pd
df = pd.read_csv('sales.csv')
print(df['amount'].sum())`,
  );
  assert.equal(result.pass, true);
  assert.equal(result.score, 1);
});

test('csv: code that prints wrong value fails', () => {
  const result = check(
    "Write Python code that reads sales.csv and sums the 'amount' column.",
    'python',
    `print(999)`,
  );
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
});

test('csv: value containing 351 as substring fails (e.g. 13510)', () => {
  const result = check(
    "Write Python code that reads sales.csv and sums the 'amount' column.",
    'python',
    `print(13510)`,
  );
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
});

test('csv: timeout can be raised for slow pandas startup', () => {
  const previous = process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS;
  try {
    process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS = '1';
    const timedOut = check(
      "Write Python code that reads sales.csv and sums the 'amount' column.",
      'python',
      `import time
time.sleep(0.05)
print(351)`,
    );
    assert.equal(timedOut.pass, false);
    assert.match(timedOut.reason, /ETIMEDOUT|timed out/i);

    process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS = '1000';
    const completed = check(
      "Write Python code that reads sales.csv and sums the 'amount' column.",
      'python',
      `import time
time.sleep(0.05)
print(351)`,
    );
    assert.equal(completed.pass, true);
    assert.equal(completed.score, 1);
  } finally {
    if (previous === undefined) delete process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS;
    else process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS = previous;
  }
});

// --- React countdown ---

test('countdown: valid React component passes', () => {
  const result = check(
    'Build me a countdown timer component in React.',
    'javascript',
    `import { useState, useEffect } from 'react';
export default function Countdown({ seconds }) {
  const [count, setCount] = useState(seconds);
  useEffect(() => {
    if (count <= 0) return;
    const id = setInterval(() => setCount(prev => prev - 1), 1000);
    return () => clearInterval(id);
  }, [count]);
  return <div>{count}</div>;
}`,
  );
  assert.equal(result.pass, true);
  assert.equal(result.score, 1);
});

test('countdown: static div without state fails', () => {
  const result = check(
    'Build me a countdown timer component in React.',
    'javascript',
    `export default function Countdown() { return <div>10</div>; }`,
  );
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
});

// --- Rate limiter ---

test('ratelimit: FastAPI with limit logic passes', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint so users can\'t spam it.',
    'python',
    `from fastapi import FastAPI, HTTPException
import time

app = FastAPI()
requests = {}

@app.get("/api")
def endpoint(user: str = "anon"):
    now = time.time()
    window = requests.get(user, [])
    window = [t for t in window if now - t < 60]
    if len(window) >= 10:
        raise HTTPException(429, "Too Many Requests")
    window.append(now)
    requests[user] = window
    return {"ok": True}`,
  );
  assert.equal(result.pass, true);
  assert.equal(result.score, 1);
});

test('ratelimit: plain endpoint without limiting fails', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint.',
    'python',
    `from fastapi import FastAPI
app = FastAPI()

@app.get("/api")
def endpoint():
    return {"ok": True}`,
  );
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
});

// --- Edge cases ---

test('unknown task is gracefully skipped', () => {
  const result = correctness('```python\nprint("hi")\n```', {
    vars: { task: 'Explain quantum computing.' },
  });
  assert.equal(result.pass, true);
  assert.equal(result.score, 1);
  assert.match(result.reason, /unknown task/i);
});
