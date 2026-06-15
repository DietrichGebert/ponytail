#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function run(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  });
}

// Keep the base env clean so the default-dir checks are deterministic; the
// CLAUDE_CONFIG_DIR case sets it explicitly.
delete process.env.CLAUDE_CONFIG_DIR;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hooks-'));
const home = path.join(temp, 'home');
const pluginData = path.join(temp, 'plugin-data');
fs.mkdirSync(home, { recursive: true });

// USERPROFILE alongside HOME: os.homedir() reads USERPROFILE on Windows, HOME on POSIX.
const codexEnv = {
  HOME: home,
  USERPROFILE: home,
  PLUGIN_DATA: pluginData,
  PONYTAIL_DEFAULT_MODE: 'ultra',
};
const codexState = path.join(pluginData, '.ponytail-active');

let result = run('ponytail-activate.js', codexEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'ultra');
let output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:ULTRA');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: ultra/,
);

result = run(
  'ponytail-mode-tracker.js',
  codexEnv,
  JSON.stringify({ prompt: '@ponytail lite' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'lite');
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:LITE');

result = run(
  'ponytail-mode-tracker.js',
  codexEnv,
  JSON.stringify({ prompt: 'normal mode' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(codexState), false);
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:OFF');

const cursorEnv = {
  HOME: home,
  USERPROFILE: home,
  CURSOR_PLUGIN_ROOT: root,
  PONYTAIL_DEFAULT_MODE: 'lite',
};
const cursorState = path.join(home, '.cursor', '.ponytail-active');

result = run('ponytail-activate.js', cursorEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(cursorState, 'utf8'), 'lite');
output = JSON.parse(result.stdout);
assert.match(output.additional_context, /PONYTAIL MODE ACTIVE — level: lite/);

result = run(
  'cursor-mode-tracker.js',
  cursorEnv,
  JSON.stringify({ prompt: '/ponytail ultra' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(cursorState, 'utf8'), 'ultra');
output = JSON.parse(result.stdout);
assert.equal(output.continue, true);

result = run(
  'cursor-mode-tracker.js',
  cursorEnv,
  JSON.stringify({ prompt: 'stop ponytail' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(cursorState), false);
output = JSON.parse(result.stdout);
assert.equal(output.continue, true);

result = run(
  'cursor-guard-shell.js',
  cursorEnv,
  JSON.stringify({ command: 'npm install left-pad' }),
);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.permission, 'ask');
assert.match(output.agent_message, /Ponytail ladder/);

result = run(
  'cursor-guard-shell.js',
  cursorEnv,
  JSON.stringify({ command: 'npm test' }),
);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.permission, 'allow');

result = run('cursor-pre-compact.js', cursorEnv);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.match(output.user_message, /Ponytail still applies/);

fs.mkdirSync(path.dirname(cursorState), { recursive: true });
fs.writeFileSync(cursorState, 'full');
result = run('cursor-session-end.js', cursorEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(cursorState), false);

const claudeEnv = {
  HOME: home,
  USERPROFILE: home,
  PONYTAIL_DEFAULT_MODE: 'full',
};
delete claudeEnv.PLUGIN_DATA;

result = run('ponytail-activate.js', claudeEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(path.join(home, '.claude', '.ponytail-active'), 'utf8'),
  'full',
);

// CLAUDE_CONFIG_DIR overrides ~/.claude for the flag file (issue #34).
const home2 = path.join(temp, 'home2');
fs.mkdirSync(home2, { recursive: true });
const customConfigDir = path.join(temp, 'custom-claude');
result = run('ponytail-activate.js', {
  HOME: home2,
  USERPROFILE: home2,
  CLAUDE_CONFIG_DIR: customConfigDir,
  PONYTAIL_DEFAULT_MODE: 'lite',
});
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(path.join(customConfigDir, '.ponytail-active'), 'utf8'),
  'lite',
);
assert.equal(
  fs.existsSync(path.join(home2, '.claude', '.ponytail-active')),
  false,
  'flag must not land in ~/.claude when CLAUDE_CONFIG_DIR is set',
);

fs.rmSync(temp, { recursive: true, force: true });
console.log('hook compatibility checks passed');
