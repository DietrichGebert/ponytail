#!/usr/bin/env node
// Guards the "one ruleset source" cleanup: SKILL.md is hand-edited, AGENTS.md and
// host copies are generated, and the SKILL-missing fallback reads AGENTS.md.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getFallbackInstructions } = require('../hooks/ponytail-instructions');

const root = path.join(__dirname, '..');

test('instruction fallback reads AGENTS.md instead of a third hardcoded ruleset', () => {
  const src = fs.readFileSync(path.join(root, 'hooks', 'ponytail-instructions.js'), 'utf8');
  assert.match(src, /AGENTS_PATH/);
  // The long ladder text must not live in the fallback function body anymore.
  assert.doesNotMatch(src, /Take the first option that fully works:/);
});

test('getFallbackInstructions returns the AGENTS body for the requested level', () => {
  const out = getFallbackInstructions('full');
  assert.match(out, /^PONYTAIL MODE ACTIVE — level: full\n/);
  assert.match(out, /in this codebase/);
  assert.match(out, /grep every caller/);
  assert.doesNotMatch(out, /Yes, this file also applies/);
});

test('getFallbackInstructions last-resort stub is short when AGENTS.md is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-fallback-'));
  const hooks = path.join(tmp, 'hooks');
  const skills = path.join(tmp, 'skills', 'ponytail');
  fs.mkdirSync(hooks, { recursive: true });
  fs.mkdirSync(skills, { recursive: true });
  for (const name of ['ponytail-config.js', 'ponytail-instructions.js']) {
    fs.copyFileSync(path.join(root, 'hooks', name), path.join(hooks, name));
  }
  // No AGENTS.md and no SKILL.md beside the copied hooks → short stub only.
  const { getFallbackInstructions: fallback } = require(path.join(hooks, 'ponytail-instructions.js'));
  const out = fallback('lite');
  assert.match(out, /^PONYTAIL MODE ACTIVE — level: lite\n/);
  assert.match(out, /lazy senior developer/);
  assert.ok(out.length < 500, 'last-resort stub must stay short');
});
