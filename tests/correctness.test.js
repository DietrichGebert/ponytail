#!/usr/bin/env node
// Unit test for the correctness benchmark assertion. Feeds known-good and
// known-bad LLM outputs through each task checker and asserts the expected
// pass/fail verdict. Runs without promptfoo — just node:test + the module.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('debounce: CommonJS export is graded by its behavior', () => {
  const good = check('Write a debounce function.', 'javascript',
    `module.exports = function(fn, delay) {
      let timer;
      return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    };`);
  assert.equal(good.pass, true, good.reason);
  assert.equal(good.score, 1);
  const bad = check('Write a debounce function.', 'javascript',
    'module.exports = (fn) => (...args) => fn(...args);');
  assert.equal(bad.pass, false);
  assert.match(bad.reason, /debounce fired immediately/);
});

test('debounce: both module formats ignore the temporary parent package type', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-format-test-'));
  const previous = process.env.TMPDIR;
  try {
    process.env.TMPDIR = dir;
    for (const type of ['module', 'commonjs']) {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type }));
      for (const prefix of ['module.exports = function', 'export function debounce']) {
        const result = check('Write a debounce function.', 'javascript',
          `${prefix}(fn, delay) {
            // module.exports in a comment must not select the module format.
            const label = 'module.exports';
            let timer;
            return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
          }`);
        assert.equal(result.pass, true, `${type}: ${prefix}: ${result.reason}`);
        assert.deepEqual(fs.readdirSync(dir), ['package.json']);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('debounce: runtime failures execute once and clean up the harness', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-format-test-'));
  const previous = process.env.TMPDIR;
  const marker = path.join(dir, 'executions');
  try {
    process.env.TMPDIR = dir;
    const result = check('Write a debounce function.', 'javascript',
      `require('node:fs').appendFileSync(${JSON.stringify(marker)}, '1');
       throw new Error('submission failed');`);
    assert.equal(result.pass, false);
    assert.match(result.reason, /submission failed/);
    assert.equal(fs.readFileSync(marker, 'utf8'), '1');
    assert.deepEqual(fs.readdirSync(dir), ['executions']);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('debounce: timeout still fails and cleans up the harness', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-format-test-'));
  const previousDir = process.env.TMPDIR;
  const previousTimeout = process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS;
  try {
    process.env.TMPDIR = dir;
    process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS = '200';
    const result = check('Write a debounce function.', 'javascript',
      'const until = Date.now() + 1000; while (Date.now() < until) {}\nmodule.exports = () => () => {};');
    assert.equal(result.pass, false);
    assert.match(result.reason, /ETIMEDOUT|timed out/i);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    if (previousDir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousDir;
    if (previousTimeout === undefined) delete process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS;
    else process.env.PONYTAIL_CORRECTNESS_TIMEOUT_MS = previousTimeout;
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
