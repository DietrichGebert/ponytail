#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('root npm test covers bundled subprojects', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  assert.match(packageJson.scripts.test, /npm test --prefix pi-extension/);
  assert.match(packageJson.scripts.test, /npm test --prefix ponytail-mcp/);
});

test('CI installs MCP dependencies before root npm test', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8');

  assert.match(workflow, /npm install --prefix ponytail-mcp/);
  assert.ok(
    workflow.indexOf('npm install --prefix ponytail-mcp') < workflow.indexOf('npm test'),
    'MCP dependencies must be installed before the root test command runs',
  );
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
