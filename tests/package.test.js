#!/usr/bin/env node
// The README tells users to run `node scripts/uninstall.js`, so the npm package
// must actually ship it. Guard the files entry so it can't silently drop out.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

test('Codex marketplace installs the npm adapter rather than the portable Git root', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.agents/plugins/marketplace.json'), 'utf8'));
  const plugin = marketplace.plugins.find((entry) => entry.name === 'ponytail');
  assert.deepEqual(plugin.source, { source: 'npm', package: pkg.name });
});

test('packed Codex adapter contains its complete runtime without shadowing its manifest', () => {
  const args = ['pack', '--dry-run', '--json', '--ignore-scripts', '--offline'];
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
      cwd: root, encoding: 'utf8', timeout: 30000,
    })
    : spawnSync('npm', args, { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const [packed] = JSON.parse(result.stdout);
  const files = new Set(packed.files.map((file) => file.path));
  const manifestPath = '.codex-plugin/plugin.json';
  assert.ok(files.has(manifestPath), 'npm must ship the Codex compatibility manifest');
  assert.ok(!files.has('plugin.json'), 'a portable root manifest suppresses hooks in Codex 0.160.0');

  const portable = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), 'utf8'));
  for (const rel of [manifest.hooks, manifest.interface.composerIcon, manifest.interface.logo]) {
    assert.ok(files.has(rel.replace(/^\.\//, '')), `packed adapter missing ${rel}`);
  }
  for (const name of fs.readdirSync(path.join(root, 'hooks'))) {
    if (/\.(js|ps1|sh)$/.test(name)) {
      assert.ok(files.has(`hooks/${name}`), `packed adapter missing hook dependency ${name}`);
    }
  }
  for (const name of fs.readdirSync(path.join(root, 'skills'))) {
    assert.ok(files.has(`skills/${name}/SKILL.md`), `packed adapter missing skill ${name}`);
  }
});
