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

test('email: bare unfenced code is still scored (#65)', () => {
  const result = correctness('import re\ndef validate_email(e):\n    return bool(re.match(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", e))', {
    vars: { task: 'Write me a Python function that validates email addresses.' },
  });
  assert.equal(result.pass, true);
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

test('debounce: bare unfenced arrow function is still scored (#65)', () => {
  const result = correctness('const debounce = (fn, delay) => {\n  let t;\n  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };\n};', {
    vars: { task: 'Write a reusable debounce function in vanilla JavaScript: debounce(fn, delay).' },
  });
  assert.equal(result.pass, true);
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

test('csv: an exception in the code is reported, not swallowed (#919)', () => {
  const result = check(
    "Write Python code that reads sales.csv and sums the 'amount' column.",
    'python',
    `raise RuntimeError("boom")`,
  );
  assert.equal(result.pass, false);
  assert.match(result.reason, /boom/);
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

test('ratelimit: a TODO comment where the limiter should be fails', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint.',
    'python',
    `from fastapi import FastAPI
app = FastAPI()

@app.get("/api")
def endpoint():
    # TODO: rate limit this endpoint
    return {"ok": True}`,
  );
  assert.equal(result.pass, false);
});

test('ratelimit: a limit that never looks at time fails', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint.',
    'python',
    `from fastapi import FastAPI, HTTPException
app = FastAPI()
count = 0

@app.get("/api")
def endpoint():
    global count
    count += 1
    if count > 1_000_000:
        raise HTTPException(500, "rate limit config missing")
    return {"ok": True}`,
  );
  assert.equal(result.pass, false);
});

test('ratelimit: slowapi limiter passes', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint.',
    'python',
    `from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter

@app.get("/api")
@limiter.limit("10/minute")
def endpoint(request: Request):
    return {"ok": True}`,
  );
  assert.equal(result.pass, true);
});

test('ratelimit: a deque limiter on time() and a Redis counter with ex= pass', () => {
  for (const code of [
    `from collections import defaultdict, deque
from time import time
from fastapi import FastAPI, HTTPException

app = FastAPI()
hits = defaultdict(deque)

@app.get("/api")
def endpoint(user: str = "anon"):
    now = time()
    q = hits[user]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= 10:
        raise HTTPException(429, "Too Many Requests")
    q.append(now)
    return {"ok": True}`,
    `import redis
from fastapi import FastAPI, HTTPException

app = FastAPI()
r = redis.Redis()

@app.get("/api")
def endpoint(user: str = "anon"):
    key = f"rl:{user}"
    r.set(key, 0, ex=60, nx=True)
    if r.incr(key) > 10:
        raise HTTPException(429, "Too Many Requests")
    return {"ok": True}`,
  ]) {
    assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python', code).pass, true);
  }
});

test('ratelimit: a lifetime counter beside a start time fails', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint.',
    'python',
    `import time
from fastapi import FastAPI, HTTPException

app = FastAPI()
STARTED = time.time()
count = 0

@app.get("/api")
def endpoint():
    global count
    count += 1
    if count > 100:
        raise HTTPException(429, "Too Many Requests")
    return {"ok": True}`,
  );
  assert.equal(result.pass, false);
});

test('ratelimit: a slowapi limiter imported and built but never applied fails', () => {
  const result = check(
    'Add rate limiting to my FastAPI endpoint.',
    'python',
    `from fastapi import FastAPI
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()

@app.get("/api")
def endpoint():
    return {"ok": True}`,
  );
  assert.equal(result.pass, false);
});

test('ratelimit: a limit decorator with a constant passes, a query .limit() alone fails', () => {
  const app = (route) => `from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

RATE_LIMIT = "10/minute"
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()

${route}`;
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python',
    app('@app.get("/api")\n@limiter.limit(RATE_LIMIT)\ndef endpoint(request: Request):\n    return {"ok": True}')).pass, true);
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python',
    app('@app.get("/api")\ndef endpoint(request: Request):\n    return db.query(Item).limit(10).all()')).pass, false);
});

test('ratelimit: a fixed window on time() // 60 passes, a RateLimiter built but not applied fails', () => {
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python', `import time
from collections import Counter
from fastapi import FastAPI, HTTPException

app = FastAPI()
hits = Counter()

@app.get("/api")
def endpoint(user: str = "anon"):
    key = (user, int(time.time() // 60))
    hits[key] += 1
    if hits[key] > 10:
        raise HTTPException(429, "Too Many Requests")
    return {"ok": True}`).pass, true);
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python', `from fastapi import FastAPI
from fastapi_limiter.depends import RateLimiter

app = FastAPI()
limiter = RateLimiter(times=10, seconds=60)

@app.get("/api")
def endpoint():
    return {"ok": True}`).pass, false);
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python', `from fastapi import Depends, FastAPI
from fastapi_limiter.depends import RateLimiter

app = FastAPI()

@app.get("/api", dependencies=[Depends(RateLimiter(times=10, seconds=60))])
def endpoint():
    return {"ok": True}`).pass, true);
});

test('ratelimit: a refusal fails', () => {
  const result = correctness("I can't help with that.", { vars: { task: 'Add rate limiting to my FastAPI endpoint.' } });
  assert.equal(result.pass, false);
});

test('ratelimit: a limiter built in one block and applied to the route in the next passes', () => {
  // A Sonnet 4.6 answer, failed as "no rate limiting, no FastAPI usage".
  const output = [
    '**Install one thing:**', '```bash', 'pip install slowapi', '```',
    '**Minimal wiring:**', '```python',
    'from slowapi import Limiter, _rate_limit_exceeded_handler',
    'from slowapi.util import get_remote_address',
    'from slowapi.errors import RateLimitExceeded',
    'limiter = Limiter(key_func=get_remote_address)',
    'app.state.limiter = limiter',
    'app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)', '```',
    '**On the endpoint:**', '```python',
    '@app.get("/your-endpoint")',
    '@limiter.limit("20/minute")',
    'async def your_endpoint(request: Request):',
    '    ...', '```',
  ].join('\n');
  assert.equal(correctness(output, { vars: { task: "Add rate limiting to my FastAPI endpoint so users can't spam it." } }).pass, true);
});

test('ratelimit: a lifetime counter whose 429 names a window fails, a window kept in an f-string key passes', () => {
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python', `from fastapi import FastAPI, HTTPException

app = FastAPI()
hits = {}

@app.get("/api")
def endpoint(user: str = "anon"):
    """Allow 10 requests per window."""
    hits[user] = hits.get(user, 0) + 1
    if hits[user] > 10:
        raise HTTPException(429, "Too many requests in this window, retry after the ttl")
    return {"ok": True}`).pass, false);
  assert.equal(check('Add rate limiting to my FastAPI endpoint.', 'python', `import time
import redis
from fastapi import FastAPI, HTTPException

app = FastAPI()
r = redis.Redis()

@app.get("/api")
def endpoint(user: str = "anon"):
    if r.incr(f"rl:{user}:{int(time.time() // 60)}") > 10:
        raise HTTPException(429, "Too Many Requests")
    return {"ok": True}`).pass, true);
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
