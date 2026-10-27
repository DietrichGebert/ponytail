#!/usr/bin/env node
// Muse Code native plugin manifest: .muse-plugin/plugin.json declares the
// six skills in skills/ and the three lifecycle hooks in hooks/ as native
// Muse capabilities, so `muse plugins install` loads ponytail without the
// Claude-compatible import (no unsupported-field diagnostics). Thin adapter:
// no copies, the manifest points at the shared files. Version is pinned with
// the other host manifests by scripts/check-versions.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.muse-plugin', 'plugin.json'), 'utf8'));

test('Muse manifest is native and points at the six skills', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.name, 'ponytail');
  assert.deepEqual(manifest.compat, { source: 'native', manifestDir: '.muse-plugin' });
  const ids = manifest.capabilities.skills.map((s) => s.id);
  assert.deepEqual(ids, ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']);
  for (const skill of manifest.capabilities.skills) {
    assert.equal(skill.path, `skills/${skill.id}/SKILL.md`);
    assert.ok(fs.existsSync(path.join(root, skill.path)), `${skill.path} must ship`);
  }
});

test('Muse hooks reuse the shared lifecycle scripts, one source per hook', () => {
  const byEvent = Object.fromEntries(manifest.capabilities.hooks.map((h) => [h.event, h]));
  assert.deepEqual(Object.keys(byEvent).sort(), ['SessionStart', 'SubagentStart', 'UserPromptSubmit']);
  const sources = manifest.capabilities.hooks.map((h) => h.command[1]);
  assert.equal(new Set(sources).size, sources.length, 'hook source paths must not be shared');
  for (const hook of manifest.capabilities.hooks) {
    assert.equal(hook.command[0], 'node');
    assert.ok(fs.existsSync(path.join(root, hook.command[1])), `${hook.command[1]} must ship`);
  }
});

test('Muse Code install is documented in INSTALL.md and the portability map', () => {
  const install = fs.readFileSync(path.join(root, 'INSTALL.md'), 'utf8');
  assert.match(install, /## Muse Code/);
  assert.match(install, /muse plugins install ponytail@ponytail/);
  const portability = fs.readFileSync(path.join(root, 'docs', 'agent-portability.md'), 'utf8');
  assert.match(portability, /\| Muse Code \(Meta\) \| `.muse-plugin\/plugin\.json`/);
});
