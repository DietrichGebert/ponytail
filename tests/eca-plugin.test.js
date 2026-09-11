#!/usr/bin/env node
// Smoke test for the ECA plugin adapter: marketplace manifest, eca.json hook
// wiring, and the ECA stdout dialect (top-level additionalContext JSON).
//
// ECA loads these hooks from the eca.json config-override merge, NOT from
// hooks/hooks.json: that path is auto-loaded by the Gemini extension with
// incompatible event names (see tests/gemini-extension.test.js), so it must
// stay absent. ${plugin:root} interpolates to the plugin directory at load
// time, so the hooks work from the git clone in ~/.eca/cache/plugins.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

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

// Keep the base env clean: a host marker leaked from the dev or CI shell
// would steer the runtime into the wrong dialect (same hygiene as
// tests/hooks.test.js).
delete process.env.CLAUDE_CONFIG_DIR;
delete process.env.PLUGIN_DATA;
delete process.env.COPILOT_PLUGIN_DATA;
delete process.env.QODER_SESSION_ID;
delete process.env.ECA_AGENT;
delete process.env.PONYTAIL_SUBAGENT_MATCHER;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-eca-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const home = path.join(temp, 'home');
fs.mkdirSync(home, { recursive: true });

// XDG_CONFIG_HOME makes getConfigDir() deterministic on every platform; the
// ECA state dir is the shared ~/.config/ponytail, not a host-private dir.
const ecaEnv = {
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: path.join(home, '.config'),
  ECA_AGENT: '1',
  PONYTAIL_DEFAULT_MODE: 'ultra',
};
const ecaState = path.join(home, '.config', 'ponytail', '.ponytail-active');

test('ECA marketplace manifest lists the repo root as the plugin source', () => {
  const marketplace = readJSON('.eca-plugin/marketplace.json');
  assert.equal(marketplace.plugins.length, 1);
  const entry = marketplace.plugins[0];
  assert.equal(entry.name, 'ponytail');
  assert.ok(entry.description, 'plugin entry must have a description');
  assert.equal(entry.source, './');
  assert.ok(
    fs.existsSync(path.join(root, 'skills', 'ponytail', 'SKILL.md')),
    'plugin source must expose skills/ for ECA pluginSkillDirs discovery',
  );
});

test('eca.json wires chatStart, preRequest and subagentStart hooks', () => {
  const hooks = readJSON('eca.json').hooks;
  const expected = {
    'ponytail-activate': ['chatStart', 'ponytail-activate.js'],
    'ponytail-mode-tracker': ['preRequest', 'ponytail-mode-tracker.js'],
    'ponytail-subagent': ['subagentStart', 'ponytail-subagent.js'],
  };
  for (const [key, [type, script]] of Object.entries(expected)) {
    assert.ok(hooks[key], `${key} must be registered`);
    assert.equal(hooks[key].type, type);
    assert.equal(hooks[key].visible, false, 'injection must stay silent in chat');
    const action = hooks[key].actions[0];
    assert.equal(action.type, 'shell');
    assert.ok(
      action.shell.includes('${plugin:root}'),
      'hook path must interpolate the plugin dir, not the workspace',
    );
    assert.ok(action.shell.includes(script), `${key} must run ${script}`);
  }
});

test('ECA adapter keeps the Gemini-sensitive hooks/hooks.json path absent', () => {
  assert.ok(!fs.existsSync(path.join(root, 'hooks', 'hooks.json')));
  assert.ok(!fs.existsSync(path.join(root, '.eca-plugin', 'hooks.json')));
});

test('activate emits the ECA dialect and stores the mode under XDG config', () => {
  const result = run('ponytail-activate.js', ecaEnv);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'PONYTAIL:ULTRA');
  assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: ultra/);
  assert.doesNotMatch(
    output.additionalContext,
    /STATUSLINE/,
    'ECA has no Claude statusline; the setup nudge must not leak in',
  );
  assert.equal(fs.readFileSync(ecaState, 'utf8'), 'ultra');
});

test('mode tracker switches the level and re-injects its ruleset in ECA dialect', () => {
  const result = run('ponytail-mode-tracker.js', ecaEnv, JSON.stringify({ prompt: '/ponytail lite' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(ecaState, 'utf8'), 'lite');
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'PONYTAIL:LITE');
  // The confirmation carries the new level's full ruleset: ECA expands skill
  // slash commands before hooks run, so this is the model's first sight of
  // the switched level's rules.
  assert.match(output.additionalContext, /^PONYTAIL MODE CHANGED — level: lite\n\n/);
  assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: lite/);
});

test('subagent hook injects the active ruleset in ECA dialect', () => {
  const result = run('ponytail-subagent.js', ecaEnv);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: lite/);
});

test('deactivation clears the flag and reports off', () => {
  const result = run('ponytail-mode-tracker.js', ecaEnv, JSON.stringify({ prompt: 'stop ponytail' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(ecaState), false, 'flag must be cleared after stop ponytail');
  const output = JSON.parse(result.stdout);
  assert.equal(output.systemMessage, 'PONYTAIL:OFF');
  assert.equal(output.additionalContext, 'PONYTAIL MODE OFF');
});

test('off mode activates quietly without a flag', () => {
  const result = run('ponytail-activate.js', { ...ecaEnv, PONYTAIL_DEFAULT_MODE: 'off' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.additionalContext, undefined, 'off must not inject context');
  assert.equal(fs.existsSync(ecaState), false, 'off must not write the flag');
});
