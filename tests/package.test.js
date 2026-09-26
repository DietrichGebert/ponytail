#!/usr/bin/env node
// The README tells users to run `node scripts/uninstall.js`, so the npm package
// must actually ship it. Guard the files entry so it can't silently drop out.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('npm package ships the advertised cleanup script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(
    pkg.files.includes('scripts/uninstall.js'),
    'package.json "files" must include scripts/uninstall.js (README tells users to run it)',
  );
  // And the file it points at must exist.
  assert.ok(
    fs.existsSync(path.join(root, 'scripts', 'uninstall.js')),
    'scripts/uninstall.js is listed in files but missing on disk',
  );
});

test('npm package exposes the v2 server entry alongside v1 (opencode 1+2 tandem)', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  // v1 consumers keep resolving `.` at the legacy file, untouched.
  assert.equal(pkg.exports['.'], './.opencode/plugins/ponytail.mjs');
  // v2 loaders resolve `./server` first; it must exist and export { id, setup }.
  const server = pkg.exports['./server'];
  assert.ok(server, 'package.json "exports" must include "./server" for opencode v2');
  const serverPath = path.join(root, server);
  assert.ok(fs.existsSync(serverPath), `"./server" points at a missing file: ${server}`);
  const { pathToFileURL } = require('url');
  const mod = await import(pathToFileURL(serverPath).href);
  assert.equal(mod.default.id, 'ponytail');
  assert.equal(typeof mod.default.setup, 'function');
});
