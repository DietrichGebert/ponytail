#!/usr/bin/env node
// Codex users trigger bundled skills with @mentions, so suggested prompts must
// be executable Codex entries instead of host-agnostic prose.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('Codex default prompts use Codex @ skill triggers', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));

  assert.deepEqual(manifest.interface.defaultPrompt, [
    '@ponytail',
    '@ponytail-review',
    '@ponytail-help',
  ]);
});
