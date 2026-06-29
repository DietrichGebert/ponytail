#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', '.cursor-plugin', 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const match = String(manifest.version || '0.0.0').match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!match) {
  throw new Error(`Unsupported Cursor plugin version: ${manifest.version}`);
}

manifest.version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Cursor plugin version bumped to ${manifest.version}`);
