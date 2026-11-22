#!/usr/bin/env node
// ponytail-review and ponytail-audit must share one finding-format body so the
// worked example and severity groups cannot drift (#1341).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const review = path.join(ROOT, 'skills/ponytail-review/references/finding-format.md');
const audit = path.join(ROOT, 'skills/ponytail-audit/references/finding-format.md');

test('finding-format.md is identical in review and audit', () => {
  const a = fs.readFileSync(review, 'utf8').replace(/\r\n/g, '\n');
  const b = fs.readFileSync(audit, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(a, b);
  assert.match(a, /Orders land on the wrong day/);
  assert.match(a, /\*\*Must fix:\*\*/);
});

test('both skills point at their local finding-format reference', () => {
  for (const name of ['ponytail-review', 'ponytail-audit']) {
    const body = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(body, /references\/finding-format\.md/);
  }
});
