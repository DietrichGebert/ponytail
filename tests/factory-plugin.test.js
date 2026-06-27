#!/usr/bin/env node
// Smoke test for the Factory Droid plugin adapter: keep command wiring minimal and
// ensure the hooks path in manifest points to the correct hooks.json.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const REQUIRED_COMMAND_FILES = [
  'ponytail.toml',
  'ponytail-review.toml',
  'ponytail-audit.toml',
  'ponytail-debt.toml',
  'ponytail-jedi.toml',
  'ponytail-lightsaber.toml',
  'ponytail-plan.toml',
  'ponytail-ask.toml',
];

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('factory plugin hooks and commands check', () => {
  const manifest = readJSON('.factory-plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.hooks, './hooks/factory-hooks.json');

  assert.ok(
    fs.existsSync(path.join(root, manifest.hooks)),
    `missing hooks file: ${manifest.hooks}`,
  );

  for (const file of REQUIRED_COMMAND_FILES) {
    assert.ok(
      fs.existsSync(path.join(root, 'commands', file)),
      `missing command file: commands/${file}`,
    );
  }
});
