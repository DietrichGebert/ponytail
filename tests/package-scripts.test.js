#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('root npm test covers bundled subprojects', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(packageJson.scripts.test, /npm test --prefix pi-extension/);
});

test('every test file in tests/ is run by a script that CI runs', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8');

  assert.match(packageJson.scripts.test, /node --test tests\/\*\.test\.js/);
  assert.equal(packageJson.scripts['test:band'], 'claude plugin test');
  assert.match(ci, /npm install -g @anthropic-ai\/claude-code@\d+\.\d+\.\d+\r?$/m);
  assert.match(ci, /^\s+run: npm run test:band\r?$/m);

  for (const file of fs.readdirSync(__dirname).filter(f => /\.test\./.test(f))) {
    assert.match(file, /\.test\.(js|ts|tsx)$/, `${file} is not run by npm test or npm run test:band`);
  }
});

test('band test files are not picked up by npm test, so test:band must exist', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const bandFiles = fs.readdirSync(__dirname).filter(f => /\.test\.(ts|tsx)$/.test(f));

  assert.ok(bandFiles.length > 0, 'expected at least one .test.ts/.test.tsx file in tests/');
  assert.doesNotMatch(packageJson.scripts.test, /\.tsx?\b/);
  assert.equal(typeof packageJson.scripts['test:band'], 'string');
});

test('CI installs a pinned Claude Code CLI before it runs the band tests', () => {
  const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8').replace(/\r\n/g, '\n');

  const install = ci.search(/^\s+run: npm install -g @anthropic-ai\/claude-code@\d+\.\d+\.\d+$/m);
  const setupNode = ci.search(/^\s+- uses: actions\/setup-node@/m);
  const band = ci.search(/^\s+run: npm run test:band$/m);

  assert.ok(install > -1, 'Claude Code install step is missing');
  assert.ok(band > -1, 'band test step is missing');
  assert.ok(setupNode > -1 && setupNode < install, 'Claude Code must be installed after setup-node');
  assert.ok(install < band, 'Claude Code must be installed before the band tests run');
  assert.doesNotMatch(ci, /@anthropic-ai\/claude-code(@latest)?\s*$/m, 'Claude Code version must be pinned');
});

test('CI runs the band tests after npm test', () => {
  const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8').replace(/\r\n/g, '\n');

  const unit = ci.search(/^\s+run: npm test$/m);
  const band = ci.search(/^\s+run: npm run test:band$/m);

  assert.ok(unit > -1 && band > unit);
  assert.equal((ci.match(/^\s+run: npm run test:band$/gm) || []).length, 1);
});

test('contributing guide documents how to run the band tests', () => {
  const contributing = fs.readFileSync(path.join(root, '.github', 'CONTRIBUTING.md'), 'utf8');

  assert.match(contributing, /^npm run test:band\b/m);
  assert.match(contributing, /Claude Code CLI/);
});

test('publishing gates OIDC access on tests and pins executable dependencies', () => {
  const publish = fs.readFileSync(path.join(root, '.github', 'workflows', 'publish.yml'), 'utf8').replace(/\r\n/g, '\n');
  const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8').replace(/\r\n/g, '\n');

  assert.match(ci, /^  workflow_call:$/m);
  assert.doesNotMatch(ci, /^    tags:/m, 'tag tests are run by the publishing workflow');
  assert.match(publish, /^  test:\n    uses: \.\/\.github\/workflows\/test\.yml$/m);
  assert.match(publish, /^  publish:\n    needs: test$/m);
  assert.match(publish, /^permissions:\n  contents: read\n\n/m);
  assert.match(publish, /^    permissions:\n      contents: read\n      id-token: write$/m);
  assert.equal((publish.match(/^\s*id-token:/gm) || []).length, 1);
  assert.doesNotMatch(ci, /id-token:/);
  assert.match(publish, /npm install -g npm@\d+\.\d+\.\d+(?:\r?\n|$)/);

  for (const workflow of [publish, ci]) {
    for (const action of workflow.matchAll(/^\s+- uses: (.+)$/gm)) {
      assert.match(action[1], /^actions\/[\w-]+@[a-f0-9]{40} # v\d+\.\d+\.\d+\r?$/);
    }
  }
});
