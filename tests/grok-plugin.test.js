#!/usr/bin/env node
// Smoke test for the Grok Build adapter: SessionStart must not crash when
// GROK_PLUGIN_* is set, must write mode state under GROK_PLUGIN_DATA, and must
// emit the ruleset on stdout (raw text, not Claude/Codex JSON wrappers).

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

test('getGrokPluginDataDir is exported and returns GROK_PLUGIN_DATA', () => {
  const { getGrokPluginDataDir } = require('../hooks/ponytail-config');
  assert.equal(typeof getGrokPluginDataDir, 'function');
  const prev = process.env.GROK_PLUGIN_DATA;
  process.env.GROK_PLUGIN_DATA = '/tmp/grok-plugin-data-test';
  try {
    assert.equal(getGrokPluginDataDir(), '/tmp/grok-plugin-data-test');
  } finally {
    if (prev === undefined) delete process.env.GROK_PLUGIN_DATA;
    else process.env.GROK_PLUGIN_DATA = prev;
  }
});

test('SessionStart activate writes mode under GROK_PLUGIN_DATA and emits ruleset', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-grok-'));
  process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

  const home = path.join(temp, 'home');
  const grokData = path.join(temp, 'grok-data');
  const grokRoot = path.join(temp, 'grok-root');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(grokData, { recursive: true });
  fs.mkdirSync(grokRoot, { recursive: true });

  const result = run('ponytail-activate.js', {
    HOME: home,
    USERPROFILE: home,
    GROK_PLUGIN_DATA: grokData,
    GROK_PLUGIN_ROOT: grokRoot,
    PONYTAIL_DEFAULT_MODE: 'full',
    // Keep other hosts from winning if the shell leaks them.
    PLUGIN_DATA: '',
    COPILOT_PLUGIN_DATA: '',
    CLAUDE_CONFIG_DIR: '',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stderr || '', /getGrokPluginDataDir is not a function/);
  assert.equal(
    fs.readFileSync(path.join(grokData, '.ponytail-active'), 'utf8'),
    'full',
  );
  assert.equal(
    fs.existsSync(path.join(home, '.claude', '.ponytail-active')),
    false,
    'Grok must not write mode state to ~/.claude',
  );
  assert.match(result.stdout, /PONYTAIL MODE ACTIVE — level: full/);
  assert.doesNotMatch(result.stdout, /STATUSLINE SETUP NEEDED/);
  // Raw text for Grok — not a Claude/Codex/Copilot JSON envelope.
  assert.throws(() => JSON.parse(result.stdout));
});

test('mode-tracker under Grok env updates GROK_PLUGIN_DATA only', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-grok-tracker-'));
  process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

  const home = path.join(temp, 'home');
  const grokData = path.join(temp, 'grok-data');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(grokData, { recursive: true });
  fs.writeFileSync(path.join(grokData, '.ponytail-active'), 'full');

  const env = {
    HOME: home,
    USERPROFILE: home,
    GROK_PLUGIN_DATA: grokData,
    GROK_PLUGIN_ROOT: path.join(temp, 'root'),
    PLUGIN_DATA: '',
    COPILOT_PLUGIN_DATA: '',
  };

  const result = run(
    'ponytail-mode-tracker.js',
    env,
    JSON.stringify({ prompt: '/ponytail ultra' }),
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(path.join(grokData, '.ponytail-active'), 'utf8'), 'ultra');
});
