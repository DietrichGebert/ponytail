#!/usr/bin/env node
// Smoke test for both OpenCode adapters: the v1 plugin's hooks (loaded via
// `main` by opencode 1.x) and the v2 entry (`exports["./server"]`, loaded by
// opencode 2.x) behave against the real (structural) OpenCode shapes. No live
// OpenCode needed.

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

let loadPlugin, parseCommandFile, v2Plugin;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.mjs'));
  const mod = await import(url);
  loadPlugin = mod.default;
  v2Plugin = (await import(pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.v2.mjs')).href)).default;
  // The frontmatter parser used to be exported from the plugin module itself.
  // OpenCode's legacy loader treats every exported function as a plugin and
  // tried to invoke it with the plugin context object, which crashed. The
  // parser now lives in its own .cjs sibling; require it directly.
  parseCommandFile = require(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail-frontmatter.cjs')).parseCommandFile;
});

function transform(hooks) {
  const output = { system: [] };
  return hooks['experimental.chat.system.transform']({ model: {} }, output).then(() => output.system);
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
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'ultra', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  const system = await transform(hooks);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('/ponytail off persists off and transform injects nothing', async () => {
  const hooks = await loadPlugin({});
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'off', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  const system = await transform(hooks);
  assert.deepEqual(system, []);
});

test('system.transform merges into existing system entry (Qwen compat, #296)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  const output = { system: ['You are a helpful assistant.'] };
  await hooks['experimental.chat.system.transform']({ model: {} }, output);
  assert.equal(output.system.length, 1, 'must not add a second system entry');
  assert.match(output.system[0], /You are a helpful assistant/);
  assert.match(output.system[0], /PONYTAIL MODE ACTIVE/);
});

test('unsupported /ponytail arguments do not reset the current mode', async () => {
  const hooks = await loadPlugin({});
  fs.writeFileSync(statePath, 'ultra');
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'status', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('unrelated commands do not touch the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin({});
  await hooks['command.execute.before']({ command: 'commit', arguments: 'x', sessionID: 's' });
  assert.equal(fs.existsSync(statePath), false);
});

test('parseCommandFile reads frontmatter description + body, LF and CRLF', () => {
  const lf = path.join(tmp, 'cmd-lf.md');
  fs.writeFileSync(lf, '---\ndescription: do a thing\n---\n\nthe template body\n');
  assert.deepEqual(parseCommandFile(lf), { description: 'do a thing', template: 'the template body' });

  // Windows checkouts (autocrlf) deliver CRLF — the parser must still match.
  const crlf = path.join(tmp, 'cmd-crlf.md');
  fs.writeFileSync(crlf, '---\r\ndescription: do a thing\r\n---\r\n\r\nthe template body\r\n');
  assert.deepEqual(parseCommandFile(crlf), { description: 'do a thing', template: 'the template body' });
});

test('parseCommandFile returns null when there is no frontmatter', () => {
  const bare = path.join(tmp, 'cmd-bare.md');
  fs.writeFileSync(bare, 'no frontmatter here\n');
  assert.equal(parseCommandFile(bare), null);
});

// --- v2 entry (opencode 2.x) ---
// v2 replaces per-turn hooks with transform domains: setup registers a
// callback that mutates a draft (agents, skill sources) on every domain
// rebuild. Minimal domain doubles capture the callbacks so a test can replay
// them and assert the resulting draft.
function mockCtx(agents) {
  const agentCallbacks = [];
  const sources = [];
  return {
    sources,
    ctx: {
      agent: { transform: async (cb) => { agentCallbacks.push(cb); } },
      skill: { transform: async (cb) => cb({ list: () => sources, source: (s) => sources.push(s) }) },
    },
    replayAgents: () => {
      const draft = { list: () => agents, update: (id, fn) => fn(agents.find((a) => a.id === id)) };
      for (const cb of agentCallbacks) cb(draft);
    },
  };
}

test('v2 default export is a plugin definition ({ id, setup })', () => {
  assert.equal(typeof v2Plugin, 'object');
  assert.equal(v2Plugin.id, 'ponytail');
  assert.equal(typeof v2Plugin.setup, 'function');
});

test('v2 setup bakes the ruleset into every agent system prompt', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const agents = [{ id: 'a' }, { id: 'b', system: 'You are helpful.' }];
  const { ctx, replayAgents } = mockCtx(agents);
  await v2Plugin.setup(ctx);
  replayAgents();
  for (const agent of agents) assert.match(agent.system, /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(agents[1].system, /You are helpful\./, 'must not clobber the agent prompt');
});

test('v2 setup injects nothing when off', async () => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, 'off');
  const agents = [{ id: 'a' }];
  const { ctx, replayAgents } = mockCtx(agents);
  await v2Plugin.setup(ctx);
  replayAgents();
  assert.equal(agents[0].system, undefined);
});

test('v2 transform replay (domain reload) does not stack duplicates', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const agents = [{ id: 'a' }];
  const { ctx, replayAgents } = mockCtx(agents);
  await v2Plugin.setup(ctx);
  replayAgents();
  replayAgents();
  assert.equal(agents[0].system.match(/PONYTAIL MODE ACTIVE/g).length, 1);
});

test('v2 setup registers the packaged skills directory once', async () => {
  const { ctx, sources } = mockCtx([]);
  await v2Plugin.setup(ctx);
  assert.deepEqual(sources, [{ type: 'directory', path: path.resolve(__dirname, '..', 'skills') }]);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
