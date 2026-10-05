#!/usr/bin/env node
// Kimi Code plugin manifest: AGENTS.md goes into the system prompt every turn,
// skills/ gives the six skills, which Kimi also exposes as /ponytail,
// /ponytail-review and so on. No hooks and no command copies: Kimi turns skills
// into slash commands itself. Kimi does not read a version field, so the
// manifest has none and stays out of the release bump.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('Kimi manifest points at AGENTS.md and the six skills', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.kimi-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ponytail');
  // Kimi ignores a systemPromptPath file over 32 KB.
  assert.ok(fs.statSync(path.join(root, manifest.systemPromptPath)).size < 32 * 1024);
  assert.match(fs.readFileSync(path.join(root, manifest.systemPromptPath), 'utf8'), /lazy senior/);
  const skills = path.join(root, manifest.skills);
  for (const name of ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
    assert.ok(fs.existsSync(path.join(skills, name, 'SKILL.md')), `${name} must ship`);
  }
});
