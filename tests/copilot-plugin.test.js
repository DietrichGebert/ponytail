#!/usr/bin/env node
// Smoke test for the Copilot plugin adapter: keep command wiring minimal and
// ensure every shared file-based command is exposed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('copilot plugin command directory includes every shared command', () => {
  const manifest = readJSON('.github/plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.commands, 'commands/');

  const commandFiles = fs.readdirSync(path.join(root, 'commands')).filter((file) => file.endsWith('.toml'));
  for (const file of commandFiles) {
    assert.ok(
      fs.existsSync(path.join(root, manifest.commands, file)),
      `missing command file: ${manifest.commands}${file}`,
    );
  }
});
