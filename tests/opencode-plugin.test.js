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
// v2 has no per-turn hooks: setup registers a callback per domain that mutates
// a draft. The doubles capture them so a test can replay and assert the draft.
function mockCtx(agents) {
  const agentCallbacks = [];
  const added = [];
  return {
    added,
    ctx: {
      agent: { transform: async (cb) => { agentCallbacks.push(cb); } },
      skill: {
        transform: async (cb) =>
          cb({
            add: (s) => added.push(s),
            list: () => added,
            get: (id) => added.find((s) => s.id === id),
            update: (id, fn) => fn(added.find((s) => s.id === id)),
            remove: (id) => added.splice(added.indexOf(added.find((s) => s.id === id)), 1),
          }),
      },
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

test('v2 registers each packaged skill with the shape the v2 draft requires', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const { ctx, added } = mockCtx([]);
  await v2Plugin.setup(ctx);
  const root = path.join(__dirname, '..', 'skills');
  const expected = fs.readdirSync(root).filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md')));
  assert.equal(added.length, expected.length, `expected one skill per SKILL.md under ${root}`);
  for (const skill of added) {
    // v2's skill schema rejects a missing id/name/path/content, and a throw
    // here disables the whole plugin, so assert every required key is present.
    assert.equal(typeof skill.id, 'string');
    assert.equal(typeof skill.name, 'string');
    assert.equal(typeof skill.path, 'string');
    assert.ok(fs.existsSync(skill.path), `${skill.id} points at a missing file`);
    assert.ok(skill.description.length > 0, `${skill.id} needs a description`);
    assert.ok(skill.content.length > 0, `${skill.id} needs content`);
    assert.ok(!skill.content.startsWith('---'), `${skill.id} content must be the body, not the raw file`);
  }
  assert.ok(added.some((s) => s.id === 'ponytail-review'), 'the review skill must register');
});

test('v2 skill descriptions fold multi-line frontmatter into one string', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const { ctx, added } = mockCtx([]);
  await v2Plugin.setup(ctx);
  const review = added.find((s) => s.id === 'ponytail-review');
  // ponytail-review's frontmatter uses `description: >` across 8 indented
  // lines; an unfolded description would be just ">" and never match a skill.
  assert.ok(review.description.length > 100, 'folded description must be joined');
  assert.ok(!review.description.includes('\n'), 'description must be a single line');
  assert.match(review.description, /over-engineering/);
});

test('v2 does not stack duplicates when the plugin is registered twice', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const agents = [{ id: 'a' }];
  const { ctx, replayAgents } = mockCtx(agents);
  await v2Plugin.setup(ctx);
  await v2Plugin.setup(ctx);
  replayAgents();
  replayAgents();
  assert.equal(agents[0].system.match(/PONYTAIL MODE ACTIVE/g).length, 1);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
