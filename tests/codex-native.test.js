import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Codex uses adaptive instructions without lifecycle hooks', () => {
  const codex = JSON.parse(read('.codex-plugin/plugin.json'));
  const claude = JSON.parse(read('.claude-plugin/plugin.json'));
  const skill = read('skills/ponytail/SKILL.md');
  assert.equal(codex.hooks, undefined);
  assert.deepEqual(codex.interface.capabilities, ['Instructions']);
  assert.equal(claude.hooks, './hooks/claude-codex-hooks.json');
  for (const clause of ['adaptive', 'Ultra', 'never automatically', 'proportional', 'in this codebase', 'security', 'accessibility']) assert.match(skill, new RegExp(clause, 'i'));
  for (const bad of ['ACTIVE EVERY RESPONSE', 'Code first.', 'at most three short lines', 'Ship the lazy version and question']) assert.doesNotMatch(skill, new RegExp(bad, 'i'));
  for (const file of ['ponytail-help', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain']) assert.ok(fs.existsSync(new URL(`../skills/${file}/SKILL.md`, import.meta.url)));
});
