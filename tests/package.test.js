#!/usr/bin/env node
// Packaging guard: npm installs use package.json#files, so a runtime file can
// pass local tests but vanish from the tarball. Assert the npm packlist still
// contains every file needed by the npm-installed OpenCode plugin and Pi
// extension.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function packagePath(value) {
  return String(value).replace(/^\.\//, '').replace(/\\/g, '/');
}

function packageFileEntries(value) {
  if (!value) return [];
  if (typeof value === 'string') return [packagePath(value)];
  if (Array.isArray(value)) return value.flatMap(packageFileEntries);
  if (typeof value === 'object') return Object.values(value).flatMap(packageFileEntries);
  return [];
}

function assertPackedEntry(files, entry) {
  const rel = packagePath(entry).replace(/\/$/, '');
  const abs = path.join(root, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    assert.ok(
      [...files].some((file) => file.startsWith(`${rel}/`)),
      `npm package is missing files under ${rel}/`,
    );
    return;
  }

  assert.ok(files.has(rel), `npm package is missing ${rel}`);
}

function packFiles() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  assert.ok(pack, 'npm pack produced no package metadata');
  return new Set(pack.files.map((file) => file.path));
}

function skillFiles() {
  return fs.readdirSync(path.join(root, 'skills'))
    .filter((name) => fs.existsSync(path.join(root, 'skills', name, 'SKILL.md')))
    .map((name) => `skills/${name}/SKILL.md`)
    .sort();
}

function opencodeCommandFiles() {
  return fs.readdirSync(path.join(root, '.opencode', 'command'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `.opencode/command/${name}`)
    .sort();
}

function hookRuntimeFiles() {
  return fs.readdirSync(path.join(root, 'hooks'))
    .filter((name) => /\.(?:js|json|ps1|sh)$/.test(name))
    .map((name) => `hooks/${name}`)
    .sort();
}

function declaredRuntimeEntries() {
  return [
    packageJson.main,
    packageJson.exports,
    packageJson.pi?.extensions,
  ].flatMap(packageFileEntries);
}

test('npm package includes the runtime files used by published adapters', () => {
  const files = packFiles();
  const required = [
    'package.json',
    'AGENTS.md',
    'pi-extension/package.json',
    ...declaredRuntimeEntries(),
    ...opencodeCommandFiles(),
    ...hookRuntimeFiles(),
    ...skillFiles(),
  ];

  for (const file of required) {
    assert.ok(files.has(file), `npm package is missing ${file}`);
  }
});

test('npm package includes every declared package entrypoint', () => {
  const files = packFiles();
  const entries = [
    packageJson.main,
    packageJson.exports,
    packageJson.pi?.extensions,
    packageJson.pi?.skills,
  ].flatMap(packageFileEntries);

  for (const entry of entries) {
    assertPackedEntry(files, entry);
  }
});
