#!/usr/bin/env node
// Grok Build adapter: mode state under GROK_PLUGIN_DATA, shared Claude/Codex
// hook map via root plugin.json, Claude-compatible hook output shapes.

const test = require('node:test');
const assert = require('node:assert/strict');
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

const cleanHost = {
  PLUGIN_DATA: '',
  COPILOT_PLUGIN_DATA: '',
  CLAUDE_CONFIG_DIR: '',
  QODER_SESSION_ID: '',
};

test('root plugin.json reuses the shared Claude/Codex hooks map', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.hooks, './hooks/claude-codex-hooks.json');
  assert.equal(manifest.mcpServers, undefined);
  assert.ok(!fs.existsSync(path.join(root, 'hooks', 'hooks.json')), 'no root hooks/hooks.json (Gemini)');
  assert.ok(
    !fs.existsSync(path.join(root, '.grok-plugin', 'hooks.json')),
    'no Grok-only hooks fork',
  );
});

test('SessionStart under Grok writes mode to GROK_PLUGIN_DATA and emits ruleset', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-grok-'));
  process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

  const home = path.join(temp, 'home');
  const grokData = path.join(temp, 'grok-data');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(grokData, { recursive: true });

  const result = run('ponytail-activate.js', {
    HOME: home,
    USERPROFILE: home,
    GROK_PLUGIN_DATA: grokData,
    GROK_PLUGIN_ROOT: path.join(temp, 'root'),
    PONYTAIL_DEFAULT_MODE: 'full',
    ...cleanHost,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(path.join(grokData, '.ponytail-active'), 'utf8'), 'full');
  assert.equal(
    fs.existsSync(path.join(home, '.claude', '.ponytail-active')),
    false,
    'Grok must not write mode state to ~/.claude',
  );
  assert.match(result.stdout, /PONYTAIL MODE ACTIVE — level: full/);
  assert.doesNotMatch(result.stdout, /STATUSLINE SETUP NEEDED/);
  // Claude-compatible SessionStart: raw ruleset text, not a JSON envelope.
  assert.throws(() => JSON.parse(result.stdout));
});

test('SubagentStart under Grok uses Claude-compatible hookSpecificOutput JSON', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-grok-sub-'));
  process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

  const home = path.join(temp, 'home');
  const grokData = path.join(temp, 'grok-data');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(grokData, { recursive: true });
  fs.writeFileSync(path.join(grokData, '.ponytail-active'), 'full');

  const result = run('ponytail-subagent.js', {
    HOME: home,
    USERPROFILE: home,
    GROK_PLUGIN_DATA: grokData,
    GROK_PLUGIN_ROOT: path.join(temp, 'root'),
    ...cleanHost,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);
});

test('mode-tracker under Grok updates GROK_PLUGIN_DATA only', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-grok-tracker-'));
  process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

  const home = path.join(temp, 'home');
  const grokData = path.join(temp, 'grok-data');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(grokData, { recursive: true });
  fs.writeFileSync(path.join(grokData, '.ponytail-active'), 'full');

  const result = run(
    'ponytail-mode-tracker.js',
    {
      HOME: home,
      USERPROFILE: home,
      GROK_PLUGIN_DATA: grokData,
      GROK_PLUGIN_ROOT: path.join(temp, 'root'),
      ...cleanHost,
    },
    JSON.stringify({ prompt: '/ponytail ultra' }),
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(path.join(grokData, '.ponytail-active'), 'utf8'), 'ultra');
});

test('Qoder path still emits JSON when Grok env is unset', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-qoder-'));
  process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, 'home');
  fs.mkdirSync(home, { recursive: true });
  const result = run('ponytail-activate.js', {
    HOME: home,
    USERPROFILE: home,
    QODER_SESSION_ID: 'test-session',
    PONYTAIL_DEFAULT_MODE: 'full',
    GROK_PLUGIN_DATA: '',
    GROK_PLUGIN_ROOT: '',
    PLUGIN_DATA: '',
    COPILOT_PLUGIN_DATA: '',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);
  assert.equal(parsed.systemMessage, undefined);
  assert.equal(
    fs.readFileSync(path.join(home, '.qoder', '.ponytail-active'), 'utf8'),
    'full',
  );
});
