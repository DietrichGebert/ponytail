#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MARKETPLACE_NAME,
  localMarketplace,
  writeLocalMarketplace,
} = require('../scripts/build-codex-local');

test('local Codex marketplace points at the current checkout', () => {
  const root = '/tmp/ponytail-checkout';
  const manifest = localMarketplace(root);

  assert.equal(manifest.name, MARKETPLACE_NAME);
  assert.equal(manifest.plugins.length, 1);
  assert.equal(manifest.plugins[0].name, 'ponytail');
  assert.deepEqual(manifest.plugins[0].source, {
    source: 'local',
    path: root,
  });
});

test('local Codex marketplace writer creates the Codex-discovered manifest path', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-local-marketplace-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const file = writeLocalMarketplace('/tmp/ponytail-checkout', dir);
  assert.equal(path.relative(dir, file), path.join('.agents', 'plugins', 'marketplace.json'));

  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(manifest.plugins[0].source.path, '/tmp/ponytail-checkout');
});
