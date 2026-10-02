#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('root MCP configuration exposes the bundled Ponytail server', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'mcp.json'), 'utf8'));
  const server = config.mcpServers.ponytail;

  assert.equal(config.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'node');
  assert.deepEqual(server.args, ['${PLUGIN_ROOT}/ponytail-mcp/index.js']);
  assert.ok(fs.existsSync(path.join(root, 'ponytail-mcp', 'index.js')));
});