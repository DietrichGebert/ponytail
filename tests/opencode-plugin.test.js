#!/usr/bin/env node
// Smoke test for the OpenCode adapter: the plugin's hooks behave against the
// real (structural) OpenCode hook shapes. No live OpenCode needed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

// Point the plugin's mode-flag at a temp config home BEFORE it loads — the
// plugin resolves its state path once at load (as it does under a real OpenCode
// process, where XDG_CONFIG_HOME is already set). The dynamic import below runs
// after this assignment, so the ordering holds.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-opencode-'));
process.env.XDG_CONFIG_HOME = tmp;
delete process.env.PONYTAIL_DEFAULT_MODE;
const statePath = path.join(tmp, 'opencode', '.ponytail-active');

let loadPlugin;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.mjs'));
  loadPlugin = (await import(url)).default;
});

function transform(hooks, input = { model: {} }) {
  const output = { system: [] };
  return hooks['experimental.chat.system.transform'](input, output).then(() => output.system);
}

function executeCommand(hooks, input) {
  const output = { parts: [] };
  return hooks['command.execute.before'](input, output).then(() => output);
}

test('system.transform injects the ruleset at the default mode (full)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  const system = await transform(hooks);
  assert.equal(system.length, 1);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(system[0], /lazy senior developer/);
});

test('command.execute.before persists /ponytail ultra, transform follows it', async () => {
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'ponytail', arguments: 'ultra', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  const system = await transform(hooks);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('/ponytail off persists off and transform injects nothing', async () => {
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'ponytail', arguments: 'off', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  const system = await transform(hooks);
  assert.deepEqual(system, []);
});

test('/ponytail-session full stays in memory and only affects its session', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'ponytail-session', arguments: 'full', sessionID: 's' });
  assert.equal(fs.existsSync(statePath), false);

  const sessionSystem = await transform(hooks, { sessionID: 's', model: {} });
  assert.equal(sessionSystem.length, 1);
  assert.match(sessionSystem[0], /PONYTAIL MODE ACTIVE — level: full/);

  await executeCommand(hooks, { command: 'ponytail', arguments: 'off', sessionID: 'other' });
  const otherSystem = await transform(hooks, { sessionID: 'other', model: {} });
  assert.deepEqual(otherSystem, []);

  const noSessionSystem = await transform(hooks, { model: {} });
  assert.deepEqual(noSessionSystem, []);
});

test('/ponytail-session off overrides a global full mode for that session only', async () => {
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'ponytail', arguments: 'full', sessionID: 'global' });
  await executeCommand(hooks, { command: 'ponytail-session', arguments: 'off', sessionID: 's' });

  const sessionSystem = await transform(hooks, { sessionID: 's', model: {} });
  assert.deepEqual(sessionSystem, []);

  const otherSystem = await transform(hooks, { sessionID: 'other', model: {} });
  assert.equal(otherSystem.length, 1);
  assert.match(otherSystem[0], /PONYTAIL MODE ACTIVE — level: full/);
});

test('unrelated commands do not touch the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'commit', arguments: 'x', sessionID: 's' });
  assert.equal(fs.existsSync(statePath), false);
});

test('/ponytail-status reports session override in output.parts and does not write the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'ponytail', arguments: 'off', sessionID: 'global' });
  await executeCommand(hooks, { command: 'ponytail-session', arguments: 'full', sessionID: 's' });

  const output = await executeCommand(hooks, { command: 'ponytail-status', arguments: '', sessionID: 's' });

  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  assert.deepEqual(output.parts, [{
    type: 'text',
    text: 'global: off\nsession: full\neffective: full\nsource: session override',
  }]);
});

test('/ponytail-status reports global mode with no session override and does not create the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  await executeCommand(hooks, { command: 'ponytail', arguments: 'off', sessionID: 'global' });

  const output = await executeCommand(hooks, { command: 'ponytail-status', arguments: '', sessionID: 'fresh-session' });

  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  assert.deepEqual(output.parts, [{
    type: 'text',
    text: 'global: off\nsession: none\neffective: off\nsource: global',
  }]);
});

const expectedSkillsDir = path.resolve(__dirname, '..', 'skills');

test('config hook registers ponytail skills dir when cfg is empty', async () => {
  const hooks = await loadPlugin({});
  const cfg = {};
  await hooks.config(cfg);
  assert.ok(Array.isArray(cfg.skills.paths));
  assert.ok(cfg.skills.paths.includes(expectedSkillsDir));
});

test('config hook registers ponytail skills dir when cfg.skills has no paths', async () => {
  const hooks = await loadPlugin({});
  const cfg = { skills: {} };
  await hooks.config(cfg);
  assert.ok(Array.isArray(cfg.skills.paths));
  assert.ok(cfg.skills.paths.includes(expectedSkillsDir));
});

test('config hook appends to existing paths without overwriting', async () => {
  const hooks = await loadPlugin({});
  const existing = ['/some/other/skills'];
  const cfg = { skills: { paths: [...existing] } };
  await hooks.config(cfg);
  assert.deepEqual(cfg.skills.paths[0], existing[0]);
  assert.ok(cfg.skills.paths.includes(expectedSkillsDir));
});

test('config hook does not duplicate ponytail skills dir', async () => {
  const hooks = await loadPlugin({});
  const cfg = { skills: { paths: [] } };
  await hooks.config(cfg);
  await hooks.config(cfg);
  const ponytailPaths = cfg.skills.paths.filter(p => p === expectedSkillsDir);
  assert.equal(ponytailPaths.length, 1);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
