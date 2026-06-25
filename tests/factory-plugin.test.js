#!/usr/bin/env node
// Smoke test for the Factory Droid adapter: the plugin manifest + marketplace
// catalog parse, the hook map wires SessionStart/UserPromptSubmit at the shared
// scripts via ${DROID_PLUGIN_ROOT}, and ponytail-runtime
// under Factory writes state to ~/.factory and emits the hookSpecificOutput JSON
// Factory reads (no systemMessage badge, no Claude statusline nudge). No live droid.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

// Hermetic: a PONYTAIL_HOST / DROID_PLUGIN_ROOT / PONYTAIL_DEFAULT_MODE leaked from
// the dev or CI shell would steer writeHookOutput into the Factory branch or change
// the default mode. Each run() sets the host explicitly; clear the rest first.
delete process.env.PONYTAIL_HOST;
delete process.env.DROID_PLUGIN_ROOT;
delete process.env.PONYTAIL_DEFAULT_MODE;

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

function run(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  });
}

test('factory plugin manifest + marketplace parse', () => {
  const manifest = readJSON('.factory-plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.hooks, './hooks/factory-hooks.json');

  const market = readJSON('.factory-plugin/marketplace.json');
  assert.equal(market.name, 'ponytail');
  assert.equal(market.plugins[0].name, 'ponytail');
  assert.equal(market.plugins[0].source, './');
});

test('factory-hooks.json wires SessionStart + UserPromptSubmit at the shared scripts', () => {
  const hooks = readJSON('hooks/factory-hooks.json').hooks;
  const session = hooks.SessionStart[0].hooks[0];
  assert.match(session.command, /\$\{DROID_PLUGIN_ROOT\}\/hooks\/ponytail-activate\.js/);
  assert.doesNotMatch(session.command, /PONYTAIL_HOST=factory/);

  const prompt = hooks.UserPromptSubmit[0].hooks[0];
  assert.match(prompt.command, /\$\{DROID_PLUGIN_ROOT\}\/hooks\/ponytail-mode-tracker\.js/);
  assert.doesNotMatch(prompt.command, /PONYTAIL_HOST=factory/);
});

test('activate under factory writes state to ~/.factory and emits hookSpecificOutput JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-factory-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  const statePath = path.join(home, '.factory', '.ponytail-active');
  const env = { HOME: home, USERPROFILE: home, PONYTAIL_HOST: 'factory', PONYTAIL_DEFAULT_MODE: 'full' };

  const result = run('ponytail-activate.js', env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'full');

  const out = JSON.parse(result.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);
  assert.equal(out.systemMessage, undefined, 'Factory must not emit the Codex systemMessage badge');
  assert.doesNotMatch(result.stdout, /STATUSLINE SETUP NEEDED/, 'Factory has no ~/.claude statusLine concept');

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('mode tracker under factory persists /ponytail ultra to ~/.factory; "normal mode" clears it', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-factory-mt-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  const statePath = path.join(home, '.factory', '.ponytail-active');
  const env = { HOME: home, USERPROFILE: home, PONYTAIL_HOST: 'factory' };

  let result = run('ponytail-mode-tracker.js', env, JSON.stringify({ prompt: '/ponytail ultra' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');

  result = run('ponytail-mode-tracker.js', env, JSON.stringify({ prompt: 'normal mode' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(statePath), false, '"normal mode" must deactivate ponytail');

  // A request that merely mentions "normal mode" must not deactivate (#161/#162).
  run('ponytail-mode-tracker.js', env, JSON.stringify({ prompt: '/ponytail lite' }));
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'lite');
  result = run('ponytail-mode-tracker.js', env, JSON.stringify({ prompt: 'add a normal mode toggle next to dark mode' }));
  assert.equal(
    fs.readFileSync(statePath, 'utf8'),
    'lite',
    'incidental "normal mode" in a request must not turn ponytail off',
  );

  fs.rmSync(tmp, { recursive: true, force: true });
});
