#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('benchmark subprocesses avoid shell command strings', () => {
  for (const rel of ['benchmarks/correctness.js', 'benchmarks/robustness-audit.js']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.doesNotMatch(src, /\bexecSync\s*\(/, `${rel} should use execFileSync with argv`);
  }
});
