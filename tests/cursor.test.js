#!/usr/bin/env node
// Runnable contract check: node --test tests/cursor.test.js (no Cursor required).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { getPonytailInstructions } = require('../hooks/ponytail-instructions');

const root = path.resolve(__dirname, '..');
const adapter = path.join(root, 'hooks/ponytail-cursor.js');
const installer = path.join(root, 'scripts/cursor.js');

test('Cursor lifecycle JSON, defaults, mode changes and off stay within the supported contract', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-cursor-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const env = { ...process.env, HOME: home, USERPROFILE: home,
    XDG_CONFIG_HOME: home, PONYTAIL_DEFAULT_MODE: '',
    CLAUDE_CONFIG_DIR: path.join(home, 'claude'), PLUGIN_DATA: path.join(home, 'codex') };
  const configDir = path.join(home, 'ponytail');
  fs.mkdirSync(configDir);
  const config = path.join(configDir, 'config.json');
  const run = (data, args = [], overrides = {}) => {
    const result = spawnSync(process.execPath, [adapter, ...args], {
      env: { ...env, ...overrides }, encoding: 'utf8', timeout: 5000,
      input: typeof data === 'string' ? data : JSON.stringify(data),
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const startup = { hook_event_name: 'sessionStart', session_id: 'one',
    conversation_id: 'one', generation_id: 'first', workspace_roots: [home],
    composer_mode: 'agent', is_background_agent: false };
  assert.ok(run(startup).additional_context.startsWith(getPonytailInstructions('full')));
  for (const mode of ['lite', 'full', 'ultra', 'off']) {
    fs.writeFileSync(config, '\uFEFF' + JSON.stringify({ defaultMode: mode }));
    const output = run(startup);
    if (mode === 'off') assert.deepEqual(output, {});
    else {
      assert.deepEqual(Object.keys(output), ['additional_context']);
      assert.ok(output.additional_context.startsWith(getPonytailInstructions(mode)));
      assert.ok(output.additional_context.includes('fixed for this conversation'));
      assert.ok(!output.additional_context.includes('STATUSLINE SETUP'));
    }
    // Editing the default cannot replace instructions already in a conversation.
    assert.deepEqual(run({ ...startup, hook_event_name: 'beforeSubmitPrompt',
      prompt: '/ponytail ' + mode }), {});
    assert.deepEqual(run({ ...startup, hook_event_name: 'subagentStart',
      subagent_type: 'generalPurpose', task: 'Check instructions' }), {});
    assert.deepEqual(run({ ...startup, hook_event_name: 'postToolUse' }), {});
    assert.deepEqual(run({ ...startup, hook_event_name: 'sessionEnd' }), {});
    // Explicit project mode takes precedence without changing the shared config.
    assert.deepEqual(run(startup, ['--mode', 'off'], { PONYTAIL_DEFAULT_MODE: 'full' }), {});
    assert.ok(run(startup, ['--mode', 'lite']).additional_context.startsWith(getPonytailInstructions('lite')));
    assert.equal(JSON.parse(fs.readFileSync(config, 'utf8').replace(/^\uFEFF/, '')).defaultMode, mode);
  }
  assert.ok(run(startup, [], { PONYTAIL_DEFAULT_MODE: 'ultra' }).additional_context.startsWith(getPonytailInstructions('ultra')));
  for (const input of ['', '{', 'null', '[]', '42', '{}', '{"hook_event_name":"SessionStart"}']) {
    assert.deepEqual(run(input), {});
  }
  assert.ok(run('\uFEFF' + JSON.stringify(startup), ['--mode', 'FULL']).additional_context);
  assert.deepEqual(run(startup, ['--mode', 'invalid']), {});
  assert.deepEqual(run(startup, ['unexpected']), {});
  assert.ok(!fs.existsSync(env.CLAUDE_CONFIG_DIR));
  assert.ok(!fs.existsSync(env.PLUGIN_DATA));
});

test('Cursor install, update and uninstall preserve unrelated hooks and rule backups', t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail cursor project '));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const cursorDir = path.join(project, '.cursor');
  const configPath = path.join(cursorDir, 'hooks.json');
  const run = (action, mode, expected = 0) => {
    const args = [installer, action, project];
    if (mode !== undefined) args.push(mode);
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, expected, result.stderr);
  };
  run('uninstall');
  assert.ok(!fs.existsSync(cursorDir));
  fs.mkdirSync(path.join(cursorDir, 'rules'), { recursive: true });
  const unrelated = { version: 1, custom: { keep: true }, hooks: {
    sessionStart: [{ command: 'node unrelated.js', timeout: 20 },
      { command: 'node "' + adapter + '" && echo user-owned-chain' }],
    afterFileEdit: [{ command: './format.sh' }],
  } };
  const original = JSON.stringify(unrelated);
  fs.writeFileSync(configPath, original);
  const rulePath = path.join(cursorDir, 'rules/ponytail.mdc');
  const rule = fs.readFileSync(path.join(root, '.cursor/rules/ponytail.mdc'), 'utf8');
  fs.writeFileSync(rulePath, rule);
  run('install', undefined, 1);
  assert.equal(fs.readFileSync(configPath, 'utf8'), original);
  assert.equal(fs.readFileSync(rulePath, 'utf8'), rule);
  const backup = path.join(cursorDir, 'ponytail.mdc.disabled');
  fs.renameSync(rulePath, backup);
  for (const mode of [undefined, undefined, 'lite', 'full', 'ultra', 'off']) {
    run('install', mode);
    const installed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(installed.hooks.sessionStart.length, 3);
    assert.deepEqual(installed.hooks.sessionStart.slice(0, 2), unrelated.hooks.sessionStart);
    assert.deepEqual(installed.hooks.afterFileEdit, unrelated.hooks.afterFileEdit);
    assert.deepEqual(installed.custom, unrelated.custom);
    const command = installed.hooks.sessionStart[2].command;
    assert.ok(!command.includes('__PONYTAIL_ROOT__'));
    const result = spawnSync(command, { shell: true, cwd: project, encoding: 'utf8',
      input: '{"hook_event_name":"sessionStart"}',
      env: { ...process.env, PONYTAIL_DEFAULT_MODE: 'full' } });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    if (mode === 'off') assert.deepEqual(output, {});
    else assert.ok(output.additional_context.startsWith(getPonytailInstructions(mode || 'full')));
  }
  run('uninstall');
  run('uninstall');
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')), unrelated);
  assert.equal(fs.readFileSync(backup, 'utf8'), rule);
  assert.ok(!fs.existsSync(rulePath), 'uninstall must not silently reactivate an always-on rule');
  for (const invalid of ['{broken', 'null', '[]', '{"version":2}',
    '{"hooks":[]}', '{"hooks":{"sessionStart":{}}}']) {
    fs.writeFileSync(configPath, invalid);
    run('install', undefined, 1);
    run('uninstall', undefined, 1);
    assert.equal(fs.readFileSync(configPath, 'utf8'), invalid);
  }
  fs.writeFileSync(configPath, '{}');
  run('install', 'review', 1);
  assert.equal(fs.readFileSync(configPath, 'utf8'), '{}');
  run('install', 'off');
  run('uninstall');
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')), { version: 1, hooks: {} });
});
