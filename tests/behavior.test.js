#!/usr/bin/env node
// Unit test for the behavior gate (benchmarks/behavior.js). Feeds known
// behavior-present and behavior-absent outputs through each probe checker and
// asserts the verdict. Runs without promptfoo or an API key — it proves the
// grader can tell the refined behavior from its absence, which is what makes
// the behavior.yaml eval trustworthy.

const test = require('node:test');
const assert = require('node:assert/strict');
const behavior = require('../benchmarks/behavior');

function check(probe, output) {
  return behavior(output, { vars: { probe } });
}

// --- hardware: leave a calibration knob ---

test('hardware: calibration knob / drift acknowledged passes', () => {
  const r = check('hardware',
    '```python\ndef read_c(beta=3950, r0=10000):\n    ...\n```\n' +
    'Notes: beta/r0 drift part-to-part, measure your own r0 at a known temp.');
  assert.equal(r.pass, true);
  assert.equal(r.score, 1);
});

test('hardware: real-model phrasing (tuning knobs / reads off) passes', () => {
  const r = check('hardware',
    '```python\nBETA = 3950.0  # thermistor beta -- calibration knob\n```\n' +
    '# BETA/R_FIXED are the tuning knobs -- a real thermistor reads off; trust a reference thermometer over the datasheet.');
  assert.equal(r.pass, true);
});

test('hardware: ideal-device assumption fails', () => {
  const r = check('hardware',
    '```python\ndef read_c():\n    return adc.read(0) * 0.1\n```\n' +
    'Notes: converts the raw ADC reading straight to Celsius.');
  assert.equal(r.pass, false);
  assert.equal(r.score, 0);
});

// --- explanation: requested write-up is not debt ---

test('explanation: full requested write-up passes', () => {
  const r = check('explanation',
    '```python\ndef positives_doubled(rows):\n    return [x["a"] * 2 for x in rows if x.get("a", 0) > 0]\n```\n' +
    '1. Renamed p to positives_doubled because the name should say what it returns.\n' +
    '2. Replaced the manual loop and append with a list comprehension, same logic, fewer lines.\n' +
    '3. Used x.get("a", 0) so a missing key is treated as zero instead of raising.\n' +
    '4. Kept the > 0 filter; the behavior is unchanged, only the shape is clearer.');
  assert.equal(r.pass, true);
});

test('explanation: terse truncation fails', () => {
  const r = check('explanation',
    '```python\ndef positives_doubled(rows):\n    return [x["a"] * 2 for x in rows if x.get("a", 0) > 0]\n```\n' +
    'skipped: the loop. comprehension covers it.');
  assert.equal(r.pass, false);
});

// --- onecheck: leave one runnable check ---

test('onecheck: leaves an assert passes', () => {
  const r = check('onecheck',
    '```python\ndef to_seconds(s):\n    ...\n\nassert to_seconds("1h30m") == 5400\n```');
  assert.equal(r.pass, true);
});

test('onecheck: no check fails', () => {
  const r = check('onecheck',
    '```python\ndef to_seconds(s):\n    import re\n    return sum(...)\n```');
  assert.equal(r.pass, false);
});

test('onecheck: mentioning assert without a runnable check fails', () => {
  const r = check('onecheck', 'The word assert is mentioned, but no runnable check exists.');
  assert.equal(r.pass, false);
});

test('onecheck: prose mentioning assert but code block has no assert fails', () => {
  const r = check('onecheck',
    'I assert this is fine.\n```python\nprint("no check")\n```');
  assert.equal(r.pass, false);
});

test('onecheck: prose mentioning assert and code block has assert passes', () => {
  const r = check('onecheck',
    'I assert this is fine.\n```python\nassert True\n```');
  assert.equal(r.pass, true);
});

test('onecheck: assert in a code comment without runnable check fails', () => {
  const r = check('onecheck',
    '```python\n# assert that the result is correct\nprint("No test was actually performed")\n```');
  assert.equal(r.pass, false);
});

test('onecheck: assert in a JS code comment without runnable check fails', () => {
  const r = check('onecheck',
    '```javascript\n// we should assert something here\nconsole.log("but we did not");\n```');
  assert.equal(r.pass, false);
});

test('onecheck: assert in a string literal fails', () => {
  const r = check('onecheck', '```python\nprint("assert")\n```');
  assert.equal(r.pass, false);
});

test('onecheck: assert in an inline comment fails', () => {
  const r = check('onecheck', '```python\nx = 1 # assert it is 1\n```');
  assert.equal(r.pass, false);
});

test('onecheck: valid Python assert after an ordinary string is detected', () => {
  const r = check('onecheck', '```python\nprint("hello")\nassert True\n```');
  assert.equal(r.pass, true);
});

test('onecheck: valid Python assert after a multiline string is detected', () => {
  const r = check('onecheck', '```python\n"""\nmultiline string\n"""\nassert True\n```');
  assert.equal(r.pass, true);
});

test('onecheck: valid JS assertion after string containing assert is detected', () => {
  const r = check('onecheck', '```javascript\nconsole.log("do not assert this");\nconsole.assert(true);\n```');
  assert.equal(r.pass, true);
});

// --- unknown probe is skipped, not failed ---

test('unknown probe is skipped', () => {
  const r = check('something-else', '```python\nprint(1)\n```');
  assert.equal(r.pass, true);
  assert.match(r.reason, /skipped/i);
});
