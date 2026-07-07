#!/usr/bin/env node
// Structural launcher for Grok Build TUI plugin.
// Ensures dependencies are installed then runs the MCP server.
// This is plugin infrastructure only — no skill or command content.

import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mcpDir = __dirname;
const nodeModules = path.join(mcpDir, 'node_modules');

if (!existsSync(nodeModules)) {
  console.error('[ponytail-mcp] Installing dependencies (first run)...');
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent', '--prefer-offline'], {
    cwd: mcpDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    console.error('[ponytail-mcp] npm install failed. Please run manually: cd ' + mcpDir + ' && npm install');
    process.exit(1);
  }
}

import('./index.js');