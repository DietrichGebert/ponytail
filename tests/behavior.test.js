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

// --- negated mentions, promised tests and refusals ---

test('hardware: a negated knob ("No calibration knob needed") fails', () => {
  assert.equal(check('hardware', '```python\ndef read_c():\n    return adc.read(0) * 0.1\n```\nNo calibration knob needed.').pass, false);
  assert.equal(check('hardware', '```python\ndef read_c(): ...\n```\nPer-unit drift is not a concern for this sensor.').pass, false);
});

test('hardware: a caveat next to a real knob still passes', () => {
  const r = check('hardware',
    '```python\nOFFSET_C = 0.0  # set per unit against a reference thermometer\n```\n' +
    'No library needed. Thermistors vary, so trim OFFSET_C for each board.');
  assert.equal(r.pass, true);
});

test('onecheck: a test promised in prose or a comment fails', () => {
  assert.equal(check('onecheck', '```python\ndef to_seconds(s):\n    ...\n```\nAdd pytest tests later if you need them.').pass, false);
  assert.equal(check('onecheck', '```python\ndef to_seconds(s):\n    ...  # assert it with pytest later\n```').pass, false);
});

test('onecheck: a demo that only prints, or installing pytest, fails', () => {
  assert.equal(check('onecheck', '```python\ndef to_seconds(s):\n    ...\n\nif __name__ == "__main__":\n    print(to_seconds("1h30m45s"))\n```').pass, false);
  assert.equal(check('onecheck', '```python\ndef to_seconds(s):\n    ...\n```\n```bash\npip install pytest\n```').pass, false);
});

test('onecheck: an assert under if __name__, or a pytest test, passes', () => {
  assert.equal(check('onecheck', '```python\ndef to_seconds(s):\n    ...\n\nif __name__ == "__main__":\n    assert to_seconds("1h30m45s") == 5445\n```').pass, true);
  assert.equal(check('onecheck', '```python\ndef test_to_seconds():\n    assert to_seconds("45s") == 45\n```').pass, true);
});

test('hardware: a closing line saying calibration was skipped fails', () => {
  const plain = '```python\ndef read_c(adc):\n    return adc.read(0) * 3.3 / 1023 * 100\n```\n';
  for (const line of ['Skipped: per-unit calibration. Risk: readings may be off by a degree or two.',
    "I didn't add a calibration offset; the datasheet values are close enough.",
    'No need for a calibration knob here.',
    'Not checked: accuracy against a reference thermometer.']) {
    assert.equal(check('hardware', plain + line).pass, false, line);
  }
});

test('hardware: a knob in a reply whose closing line skips something else passes', () => {
  const r = check('hardware',
    '```python\nR0 = 10_000  # measure your own at 25 C\n```\nSkipped: averaging several reads, add it if readings jitter.');
  assert.equal(r.pass, true);
});

test('hardware: drift dismissed after the mention fails', () => {
  assert.equal(check('hardware', "```python\ndef read_c(): ...\n```\nPer-unit drift doesn't matter here.").pass, false);
  assert.equal(check('hardware', '```python\ndef read_c(): ...\n```\nThermistors drift, but no calibration knob is needed.').pass, false);
  assert.equal(check('hardware', '```python\ndef read_c(): ...\n```\nPer-unit calibration: skipped.').pass, false);
  assert.equal(check('hardware', '```python\nOFFSET_C = 0.0\n```\nDrift per unit is real, so expose a calibration knob, and no extra library is needed.').pass, true);
});

test('onecheck: an unfenced reply counts whole, prose alone still fails', () => {
  assert.equal(check('onecheck', 'def to_seconds(s):\n    ...\n\nassert to_seconds("45s") == 45').pass, true);
  assert.equal(check('onecheck', 'Add pytest tests later if you need them.').pass, false);
});

test('a refusal fails every probe', () => {
  for (const probe of ['hardware', 'explanation', 'onecheck']) {
    assert.equal(check(probe, "I can't help with that.").pass, false, probe);
  }
});

// --- unknown probe is skipped, not failed ---

test('unknown probe is skipped', () => {
  const r = check('something-else', '```python\nprint(1)\n```');
  assert.equal(r.pass, true);
  assert.match(r.reason, /skipped/i);
});
