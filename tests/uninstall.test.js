#!/usr/bin/env node
// uninstall.js must remove the opencode mode flag and the ponytail config
// file, survive an already-clean machine, and touch nothing else.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function runUninstall(env) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'uninstall.js')], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-uninstall-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const xdg = path.join(temp, 'config-home');
const flagPath = path.join(xdg, 'opencode', '.ponytail-active');
const configPath = path.join(xdg, 'ponytail', 'config.json');
fs.mkdirSync(path.dirname(flagPath), { recursive: true });
fs.writeFileSync(flagPath, 'full');
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify({ defaultMode: 'ultra' }));

let result = runUninstall({ XDG_CONFIG_HOME: xdg });
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(flagPath), false, 'mode flag must be removed');
assert.equal(fs.existsSync(configPath), false, 'config file must be removed');

// Running again on an already-clean machine must not throw.
result = runUninstall({ XDG_CONFIG_HOME: xdg });
assert.equal(result.status, 0, result.stderr);

console.log('uninstall script checks passed');
