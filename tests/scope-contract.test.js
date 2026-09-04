#!/usr/bin/env node
// Regression guard for the failure mode where Ponytail treats minimum size as
// the objective and optimises away a materially better complete outcome.

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
  'Outcome before simplicity',
  'strongest evidence-backed complete outcome',
  'Simplicity is a tiebreaker only when expected outcomes are materially equivalent',
  'A larger, more sophisticated, or longer solution is correct',
  'Do not invent caps, thresholds, test counts, timeouts, or budgets',
  'Test and review in proportion to the behaviour, risk, and acceptance claims',
  'The best complete outcome is the target',
];

function phrasePattern(phrase) {
  return new RegExp(
    phrase.trim().split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+'),
  );
}

for (const phrase of required) {
  test(`scope contract keeps ${phrase}`, () => {
    assert.match(skill, phrasePattern(phrase));
    assert.match(agents, phrasePattern(phrase));
  });
}

test('hook fallbacks preserve outcome before simplicity', () => {
  for (const fallback of [hookFallback, hermesFallback]) {
    assert.match(fallback, /strongest evidence-backed complete outcome/);
    assert.match(fallback, /Simplicity is a tiebreaker only/);
    assert.match(fallback, /Larger or more sophisticated work is correct/);
    assert.match(fallback, /Test and review in proportion/);
    assert.match(fallback, /best complete outcome is the target/i);
  }
});

test('active contracts reject size-first and arbitrary-ceiling instructions', () => {
  const forbidden = [
    /Ship the lazy version/,
    /first lazy solution that works/i,
    /Shortest working diff wins/i,
    /YAGNI extremist/i,
    /at most three short lines/i,
    /leaves ONE runnable check/i,
    /shortest path to done/i,
    /minimum code that works/i,
  ];
  for (const source of [skill, agents, hookFallback, hermesFallback]) {
    for (const phrase of forbidden) assert.doesNotMatch(source, phrase);
  }
});
