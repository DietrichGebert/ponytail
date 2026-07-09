// Regression guard for the gate fixes (issue #65). Run: node correctness.test.js
// Needs python + node on PATH, same as correctness.js itself.
const assert = require('assert');
const check = require('./correctness.js');

const emailTask = { vars: { task: 'Write me a Python function that validates email addresses.' } };
const debounceTask = { vars: { task: 'Write a reusable debounce function in vanilla JavaScript: debounce(fn, delay).' } };

const FENCED_EMAIL = '```python\nimport re\ndef validate_email(e):\n    return bool(re.match(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", e))\n```';
const UNFENCED_EMAIL = 'import re\ndef validate_email(e):\n    return bool(re.match(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", e))';
const WRONG_EMAIL = '```python\ndef validate_email(e):\n    return True  # accepts everything\n```';
const UNFENCED_ARROW_DEBOUNCE = 'const debounce = (fn, delay) => {\n  let t;\n  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };\n};';

let pass = 0;
const cases = [
  ['fenced email still passes', check(FENCED_EMAIL, emailTask).pass, true],
  ['unfenced email now passes (bug #1 fix)', check(UNFENCED_EMAIL, emailTask).pass, true],
  ['broken email still fails', check(WRONG_EMAIL, emailTask).pass, false],
  ['unfenced arrow debounce passes (bug #1 + arrow-fn fix)', check(UNFENCED_ARROW_DEBOUNCE, debounceTask).pass, true],
];
for (const [name, got, want] of cases) {
  assert.strictEqual(got, want, `FAILED: ${name} (got ${got}, want ${want})`);
  console.log(`ok - ${name}`);
  pass++;
}
console.log(`\n${pass}/${cases.length} passed`);
