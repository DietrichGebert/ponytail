#!/usr/bin/env node
// Smoke test for the OpenCode adapter: the plugin's hooks behave against the
// real (structural) OpenCode hook shapes. No live OpenCode needed.
// Covers both entrypoints of the dual V1/V2 export: server() (V1 object form)
// and id + setup() (V2).

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

let plugin, parseCommandFile;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.mjs'));
  const mod = await import(url);
  plugin = mod.default;
  // The frontmatter parser used to be exported from the plugin module itself.
  // OpenCode's legacy loader treats every exported function as a plugin and
  // tried to invoke it with the plugin context object, which crashed. The
  // parser now lives in its own .cjs sibling; require it directly.
  parseCommandFile = require(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail-frontmatter.cjs')).parseCommandFile;
});

test('default export serves V1 (server) and V2 (id + setup) from one object', () => {
  assert.equal(plugin.id, 'ponytail');
  assert.equal(typeof plugin.setup, 'function');
  assert.equal(typeof plugin.server, 'function');
});

function transform(hooks) {
  const output = { system: [] };
  return hooks['experimental.chat.system.transform']({ model: {} }, output).then(() => output.system);
}

test('system.transform injects the ruleset at the default mode (full)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await plugin.server({});
  const system = await transform(hooks);
  assert.equal(system.length, 1);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(system[0], /lazy senior developer/);
});

test('command.execute.before persists /ponytail ultra, transform follows it', async () => {
  const hooks = await plugin.server({});
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'ultra', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  const system = await transform(hooks);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('/ponytail off persists off and transform injects nothing', async () => {
  const hooks = await plugin.server({});
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'off', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  const system = await transform(hooks);
  assert.deepEqual(system, []);
});

test('system.transform merges into existing system entry (Qwen compat, #296)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await plugin.server({});
  const output = { system: ['You are a helpful assistant.'] };
  await hooks['experimental.chat.system.transform']({ model: {} }, output);
  assert.equal(output.system.length, 1, 'must not add a second system entry');
  assert.match(output.system[0], /You are a helpful assistant/);
  assert.match(output.system[0], /PONYTAIL MODE ACTIVE/);
});

test('unsupported /ponytail arguments do not reset the current mode', async () => {
  const hooks = await plugin.server({});
  fs.writeFileSync(statePath, 'ultra');
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'status', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('unrelated commands do not touch the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await plugin.server({});
  await hooks['command.execute.before']({ command: 'commit', arguments: 'x', sessionID: 's' });
  assert.equal(fs.existsSync(statePath), false);
});

// Minimal structural stand-in for the V2 plugin context: records transforms,
// hooks, and submitted prompts so setup() can run with no live OpenCode.
function makeV2Ctx() {
  const commands = [];
  const skills = [];
  const hooks = {};
  const prompts = [];
  return {
    commands,
    skills,
    hooks,
    prompts,
    ctx: {
      command: {
        transform: async (cb) => { cb({ add: (def) => commands.push(def) }); },
      },
      skill: {
        transform: async (cb) => {
          cb({ add: (s) => skills.push(s), list: () => [], get: () => undefined, update: () => {}, remove: () => {} });
        },
      },
      session: {
        hook: async (name, cb) => { hooks[name] = cb; },
        prompt: async (input) => { prompts.push(input); return input; },
      },
    },
  };
}

const expectedCommands = ['ponytail', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help', 'ponytail-review'];

test('V2 setup registers every packaged command and skill', async () => {
  const v2 = makeV2Ctx();
  await plugin.setup(v2.ctx);
  assert.deepEqual(v2.commands.map((c) => c.name).sort(), [...expectedCommands].sort());
  for (const cmd of v2.commands) {
    assert.ok(cmd.description, `${cmd.name} needs a description`);
    assert.equal(typeof cmd.execute, 'function');
  }
  assert.deepEqual(v2.skills.map((s) => s.id).sort(), [...expectedCommands].sort());
  for (const skill of v2.skills) {
    assert.ok(skill.description, `${skill.id} needs a description`);
    assert.ok(skill.content.includes('ponytail') || skill.content.length > 0, `${skill.id} needs body content`);
  }
  assert.equal(typeof v2.hooks.context, 'function');
});

test('V2 context hook injects the ruleset, stays silent when off', async () => {
  const v2 = makeV2Ctx();
  await plugin.setup(v2.ctx);
  try { fs.unlinkSync(statePath); } catch (e) {}
  const event = { system: [] };
  v2.hooks.context(event);
  assert.equal(event.system.length, 1);
  assert.equal(event.system[0].type, 'text');
  assert.match(event.system[0].text, /PONYTAIL MODE ACTIVE — level: full/);

  fs.writeFileSync(statePath, 'off');
  const silent = { system: [] };
  v2.hooks.context(silent);
  assert.deepEqual(silent.system, []);
});

test('V2 /ponytail execute persists the mode and expands $ARGUMENTS', async () => {
  const v2 = makeV2Ctx();
  await plugin.setup(v2.ctx);
  try { fs.unlinkSync(statePath); } catch (e) {}
  const cmd = v2.commands.find((c) => c.name === 'ponytail');
  await cmd.execute({ sessionID: 's', prompt: { text: 'ultra' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  assert.equal(v2.prompts.length, 1);
  assert.match(v2.prompts[0].text, /ponytail ultra mode/);
  assert.ok(!v2.prompts[0].text.includes('$ARGUMENTS'), 'template placeholder must be expanded');
});

test('V2 /ponytail with a bad level prompts but leaves the flag alone', async () => {
  const v2 = makeV2Ctx();
  await plugin.setup(v2.ctx);
  fs.writeFileSync(statePath, 'ultra');
  const cmd = v2.commands.find((c) => c.name === 'ponytail');
  await cmd.execute({ sessionID: 's', prompt: { text: 'status' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  assert.equal(v2.prompts.length, 1);
});

test('V2 template without a placeholder appends arguments after a blank line', async () => {
  const v2 = makeV2Ctx();
  await plugin.setup(v2.ctx);
  const cmd = v2.commands.find((c) => c.name === 'ponytail-review');
  await cmd.execute({ sessionID: 's', prompt: { text: 'src/cache.ts' }, delivery: 'steer' });
  assert.match(v2.prompts[0].text, /\n\nsrc\/cache\.ts$/);
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

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
