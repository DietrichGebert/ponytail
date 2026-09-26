#!/usr/bin/env node
// Smoke test for the OpenCode v2 adapter: `Plugin.define({ id, setup })`
// shape plus the two transforms it registers, against mock domains. No live
// OpenCode needed. Mirrors tests/opencode-plugin.test.js (v1) case for case
// where the v2 platform allows it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

// Point the adapter's mode-flag at a temp config home BEFORE it loads.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-opencode-v2-'));
process.env.XDG_CONFIG_HOME = tmp;
delete process.env.PONYTAIL_DEFAULT_MODE;
const statePath = path.join(tmp, 'opencode', '.ponytail-active');

let plugin;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.v2.mjs'));
  plugin = (await import(url)).default;
});

// Minimal v2 domain doubles: capture transform callbacks, replay on demand.
function mockCtx(agents) {
  const state = { agentTransforms: [], skillTransforms: [], sources: [] };
  return {
    state,
    ctx: {
      agent: {
        transform: async (cb) => { state.agentTransforms.push(cb); },
        reload: async () => {},
      },
      skill: {
        transform: async (cb) => {
          state.skillTransforms.push(cb);
          cb({ list: () => state.sources, source: (s) => state.sources.push(s) });
        },
        reload: async () => {},
      },
    },
    runAgentTransforms: () => {
      const draft = {
        list: () => agents,
        update: (id, fn) => fn(agents.find((a) => a.id === id)),
      };
      for (const cb of state.agentTransforms) cb(draft);
    },
  };
}

test('default export is a v2 plugin definition ({ id, setup })', async () => {
  assert.equal(typeof plugin, 'object');
  assert.equal(plugin.id, 'ponytail');
  assert.equal(typeof plugin.setup, 'function');
});

test('setup injects the ruleset into every agent system prompt', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const agents = [{ id: 'a' }, { id: 'b', system: 'You are helpful.' }];
  const { ctx, runAgentTransforms } = mockCtx(agents);
  await plugin.setup(ctx);
  runAgentTransforms();
  for (const a of agents) {
    assert.match(a.system, /PONYTAIL MODE ACTIVE — level: full/);
  }
  assert.match(agents[1].system, /You are helpful\./);
});

test('off mode injects nothing', async () => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, 'ultra');
  const agents = [{ id: 'a' }];
  const { ctx, runAgentTransforms } = mockCtx(agents);
  fs.writeFileSync(statePath, 'off');
  await plugin.setup(ctx);
  runAgentTransforms();
  assert.equal(agents[0].system, undefined);
});

test('re-running transforms (domain reload) never stacks duplicates', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const agents = [{ id: 'a' }];
  const { ctx, runAgentTransforms } = mockCtx(agents);
  await plugin.setup(ctx);
  runAgentTransforms();
  runAgentTransforms();
  assert.equal(agents[0].system.match(/PONYTAIL MODE ACTIVE/g).length, 1);
});

test('setup registers the packaged skills directory once', async () => {
  const agents = [];
  const { ctx, state } = mockCtx(agents);
  await plugin.setup(ctx);
  // skill.transform runs inline in the mock, like a domain rebuild would.
  assert.equal(state.sources.length, 1);
  assert.equal(state.sources[0].type, 'directory');
  assert.ok(state.sources[0].path.endsWith(path.join('ponytail', 'skills')) || state.sources[0].path.endsWith(path.sep + 'skills'));
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
