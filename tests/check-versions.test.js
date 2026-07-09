#!/usr/bin/env node
// Regression test: plugin.yaml (the Hermes Agent manifest) declares its own
// version and is bumped by hand at release time same as the other manifests
// (see c99757a), but was missing from VERSION_FILES — so it could drift
// unnoticed, the exact failure mode check-versions.js exists to catch
// (#260/#262).

const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'check-versions.js')], {
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr);
assert.match(
  result.stdout,
  /All 8 version files pinned/,
  'plugin.yaml must be tracked alongside the other 7 manifests',
);

console.log('check-versions.js tracks plugin.yaml');
