#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { childEnv } = require('./child-env');

const root = path.join(__dirname, '..');

function runUninstall(env) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'uninstall.js')], {
    env: childEnv(env),
    encoding: 'utf8',
  });
}

delete process.env.CLAUDE_CONFIG_DIR;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'crewcut-uninstall-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const home = path.join(temp, 'home');
const claudeDir = path.join(home, '.claude');
fs.mkdirSync(claudeDir, { recursive: true });

const flagPath = path.join(claudeDir, '.crewcut-active');
fs.writeFileSync(flagPath, 'full');

const nudgeFlagPath = path.join(claudeDir, '.crewcut-statusline-nudged');
fs.writeFileSync(nudgeFlagPath, '');

const configDir = path.join(temp, 'config-home', 'crewcut');
fs.mkdirSync(configDir, { recursive: true });
const configPath = path.join(configDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify({ defaultMode: 'ultra' }));

// #1032: the statusline script copy kept in the config dir.
const statuslineCopyPath = path.join(claudeDir, 'crewcut-statusline.sh');
fs.writeFileSync(statuslineCopyPath, '#!/usr/bin/env bash\n');
const statuslinePs1CopyPath = path.join(claudeDir, 'crewcut-statusline.ps1');
fs.writeFileSync(statuslinePs1CopyPath, '');

const settingsPath = path.join(claudeDir, 'settings.json');
const settings = JSON.stringify({
  marker: 'crewcut-test-marker',
  statusLine: { type: 'command', command: 'bash /some/path/crewcut-statusline.sh' },
});
fs.writeFileSync(settingsPath, settings);

const env = {
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: path.join(temp, 'config-home'),
};

let result = runUninstall(env);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(flagPath), false, 'mode flag must be removed');
assert.equal(fs.existsSync(nudgeFlagPath), false, 'statusline nudge flag must be removed');
assert.equal(fs.existsSync(configPath), false, 'config file must be removed');
assert.equal(fs.existsSync(statuslineCopyPath), false, 'statusline script copy must be removed (#1032)');
assert.equal(fs.existsSync(statuslinePs1CopyPath), false, 'statusline .ps1 copy must be removed (#1032)');

// settings.json is never read or written: the user removes the statusLine by hand.
assert.equal(fs.readFileSync(settingsPath, 'utf8'), settings, 'settings.json must be left unchanged');
assert.ok(result.stdout.includes(settingsPath) && result.stdout.includes('crewcut-statusline'), 'must tell the user to remove the statusLine by hand');
assert.ok(!(result.stdout + result.stderr).includes('crewcut-test-marker'), 'settings.json content must not be printed');

// Running on an already-clean machine must not throw.
result = runUninstall({ HOME: path.join(temp, 'home-empty'), USERPROFILE: path.join(temp, 'home-empty') });
assert.equal(result.status, 0, result.stderr);

console.log('uninstall script checks passed');
