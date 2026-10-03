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


test('agentic metrics count conventional JS TS and Go test names separately', () => {
  require('node:child_process').execFileSync('python3', ['-c', `
from pathlib import Path
import subprocess, sys, tempfile
sys.path.insert(0, str(Path(sys.argv[1]) / 'benchmarks/agentic'))
import run
with tempfile.TemporaryDirectory() as d:
    ws = Path(d)
    def git(*args):
        subprocess.run(['git', *args], cwd=ws, check=True, capture_output=True)
    git('init', '-q')
    git('-c', 'commit.gpgsign=false', '-c', 'user.email=test@local', '-c', 'user.name=test', 'commit', '--allow-empty', '-qm', 'base', '--no-verify')
    tests = ('cache.test.js', 'view.spec.ts', 'widget.test.tsx', 'server_test.go', '__tests__/helper.js', 'test_helper.py', 'cache_test.py', 'tests/check.py')
    sources = ('cache.js', 'contest/view.ts', 'server.go', 'specification.ts')
    for name in tests + sources:
        p = ws / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('one line\\nsecond line\\n')
    expected = dict(files=12, src_files=4, total_loc=8, src_loc=8, test_files=8, test_loc=16)
    assert run.code_stats(ws) == expected, run.code_stats(ws)
    diff_expected = {**expected, 'files': 4}
    assert run.git_diff_stats(ws) == diff_expected, run.git_diff_stats(ws)
    assert all(run._is_test(ws / name, ws) for name in tests)
    assert not any(run._is_test(ws / name, ws) for name in sources)
    print('normal and git-diff metrics classify JS/TS/Go tests without excluding similarly named source')
`, require('node:path').resolve(__dirname, '..')], { stdio: 'pipe', timeout: 10_000 });
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
