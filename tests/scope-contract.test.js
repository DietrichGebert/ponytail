#!/usr/bin/env node
// Regression guard for the failure mode where Ponytail optimises away required
// work (for example, writing four tests for a complex feature that needs 50+).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'skills', 'ponytail', 'SKILL.md'), 'utf8');
const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const hookFallback = fs.readFileSync(path.join(root, 'hooks', 'ponytail-instructions.js'), 'utf8');
const hermesFallback = fs.readFileSync(path.join(root, '__init__.py'), 'utf8');

const required = [
  'Scope before simplicity',
  'smallest complete solution',
  'coverage follows the risk and behaviour',
  'temporary patch',
];

for (const phrase of required) {
  test(`scope contract keeps ${phrase}`, () => {
    assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(agents, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('hook fallbacks preserve scope before simplicity', () => {
  for (const fallback of [hookFallback, hermesFallback]) {
    assert.match(fallback, /Scope before simplicity/);
    assert.match(fallback, /smallest complete solution/);
    assert.match(fallback, /temporary patch/);
    assert.doesNotMatch(fallback, /Ship the lazy version/);
  }
});

test('complex requests are not instructed to ship a lazy substitute', () => {
  assert.doesNotMatch(skill, /Ship the lazy version/);
  assert.doesNotMatch(agents, /Ship the lazy version/);
});
