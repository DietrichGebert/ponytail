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

test('CI installs root and MCP dependencies before checking V2 and running tests', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'test.yml'), 'utf8');

  assert.match(workflow, /run: npm ci\s*\n/);
  assert.match(workflow, /npm run typecheck:v2/);
  assert.ok(workflow.indexOf('npm ci') < workflow.indexOf('npm run typecheck:v2'));
  assert.ok(workflow.indexOf('npm run typecheck:v2') < workflow.indexOf('npm test'));
  assert.match(workflow, /npm install --prefix ponytail-mcp/);
  assert.ok(
    workflow.indexOf('npm install --prefix ponytail-mcp') < workflow.indexOf('npm test'),
    'MCP dependencies must be installed before the root test command runs',
  );
});
