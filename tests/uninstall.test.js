#!/usr/bin/env node

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

delete process.env.CLAUDE_CONFIG_DIR;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-uninstall-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const home = path.join(temp, 'home');
const claudeDir = path.join(home, '.claude');
fs.mkdirSync(claudeDir, { recursive: true });

const flagPath = path.join(claudeDir, '.ponytail-active');
fs.writeFileSync(flagPath, 'full');

const configDir = path.join(temp, 'config-home', 'ponytail');
fs.mkdirSync(configDir, { recursive: true });
const configPath = path.join(configDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify({ defaultMode: 'ultra' }));

const settingsPath = path.join(claudeDir, 'settings.json');
fs.writeFileSync(settingsPath, JSON.stringify({
  statusLine: { type: 'command', command: 'bash /some/path/ponytail-statusline.sh' },
}));

const env = {
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: path.join(temp, 'config-home'),
};

let result = runUninstall(env);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(flagPath), false, 'mode flag must be removed');
assert.equal(fs.existsSync(configPath), false, 'config file must be removed');

const settingsAfter = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
assert.equal(
  settingsAfter.statusLine,
  undefined,
  'ponytail statusLine entry must be removed',
);

// A user's own, unrelated statusLine must survive untouched.
fs.writeFileSync(settingsPath, JSON.stringify({
  statusLine: { type: 'command', command: 'bash ~/my-custom-statusline.sh' },
}));

result = runUninstall(env);
assert.equal(result.status, 0, result.stderr);
const settingsAfter2 = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
assert.equal(
  settingsAfter2.statusLine.command,
  'bash ~/my-custom-statusline.sh',
  "a user's own statusLine must not be touched",
);

// #374: a combined statusline (another plugin && ponytail) must keep the other
// plugin's part — uninstall must not nuke the whole command or leave a husk.
fs.writeFileSync(settingsPath, JSON.stringify({
  statusLine: { type: 'command', command: 'bash ~/caveman-statusline.sh && bash /p/ponytail-statusline.sh' },
}));

result = runUninstall(env);
assert.equal(result.status, 0, result.stderr);
const settingsAfter3 = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
assert.equal(
  settingsAfter3.statusLine.command,
  'bash ~/caveman-statusline.sh && bash /p/ponytail-statusline.sh',
  'a combined statusLine must be left untouched, not partially destroyed',
);

// Running on an already-clean machine must not throw.
result = runUninstall({ HOME: path.join(temp, 'home-empty'), USERPROFILE: path.join(temp, 'home-empty') });
assert.equal(result.status, 0, result.stderr);

console.log('uninstall script checks passed');