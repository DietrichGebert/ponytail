#!/usr/bin/env node
// Grok Build loads Ponytail through its native skill system. Lifecycle-hook
// stdout is passive in Grok, so this adapter must not register any hooks.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('Grok manifest is a skill-only adapter with no lifecycle hooks', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.hooks, undefined);
  assert.equal(manifest.mcpServers, undefined);
  assert.ok(!fs.existsSync(path.join(root, 'hooks', 'hooks.json')));
  assert.ok(!fs.existsSync(path.join(root, '.grok-plugin', 'hooks.json')));
});

test('Ponytail skill describes every coding task for Grok auto-invocation', () => {
  const skill = fs.readFileSync(path.join(root, 'skills', 'ponytail', 'SKILL.md'), 'utf8');
  assert.match(skill, /Use on any\s+coding task/i);
  assert.match(skill, /writing,\s+fixing, refactoring, reviewing/i);
  assert.doesNotMatch(skill, /disable-model-invocation:\s*true/i);
});

test('Grok marketplace resolves a subdirectory with the same skills as direct installation', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, '.grok-plugin', 'marketplace.json'), 'utf8'));
  const entry = catalog.plugins.find((plugin) => plugin.name === 'ponytail');
  const pluginRoot = path.resolve(root, entry.source);
  // Grok rejects a marketplace source of "./", even though direct installation works.
  assert.notEqual(pluginRoot, root, 'marketplace source must name a subdirectory');
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, entry.name);
  assert.equal(manifest.hooks, undefined);
  assert.equal(manifest.mcpServers, undefined);
  assert.equal(path.resolve(pluginRoot, manifest.skills), path.join(root, 'skills'));
});
