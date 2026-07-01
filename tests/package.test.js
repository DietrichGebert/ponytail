#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

test('npm package ships the advertised cleanup script', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-pack-'));
  try {
    const npmCommand = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    const npmArgs = process.env.npm_execpath
      ? [process.env.npm_execpath, 'pack', '--dry-run', '--json']
      : ['pack', '--dry-run', '--json'];
    const result = spawnSync(npmCommand, npmArgs, {
      cwd: root,
      env: { ...process.env, npm_config_cache: path.join(temp, 'npm-cache') },
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const [pack] = JSON.parse(result.stdout);
    const files = new Set(pack.files.map((file) => file.path));
    assert.ok(files.has('scripts/uninstall.js'), 'missing scripts/uninstall.js from npm package');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
