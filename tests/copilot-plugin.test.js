#!/usr/bin/env node
// Smoke test for the Copilot marketplace adapter: it installs the root
// Agent Plugins manifest, which discovers skills from the shared directory.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const COPILOT_HOOKS = 'com.github.copilot/hooks/hooks.json';

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('Copilot marketplace installs the root Agent Plugins manifest', () => {
  const manifest = readJSON('plugin.json');
  const marketplace = readJSON('.github/plugin/marketplace.json');
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(marketplace.plugins[0].source, './');
  assert.equal(fs.existsSync(path.join(root, '.github', 'plugin', 'plugin.json')), false);
  assert.equal(readJSON(COPILOT_HOOKS).version, 1);
});
