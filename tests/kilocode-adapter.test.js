#!/usr/bin/env node
// Issue #300: Kilo Code VS Code extension adapter. Verifies the rule file is
// shipped, has the canonical body, and is enrolled in the rule-copy checker.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const KILOCODE_RULE = '.kilocode/rules/ponytail.md';
const CLINE_RULE = '.clinerules/ponytail.md';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n').trim();
}

test('kilocode adapter file exists with the canonical compact body', () => {
  assert.equal(read(KILOCODE_RULE), read(CLINE_RULE));
});

test('check-rule-copies enrolls the kilocode adapter', () => {
  const script = read('scripts/check-rule-copies.js');
  assert.ok(script.includes(KILOCODE_RULE), 'kilocode path missing from check-rule-copies.js');
  execFileSync(process.execPath, [path.join(root, 'scripts/check-rule-copies.js')], { stdio: 'pipe' });
});
