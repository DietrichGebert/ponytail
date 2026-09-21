#!/usr/bin/env node
// Smoke test for the OpenCode adapter: the plugin's V2 definition (setup) and
// V1 fallback (server) behave against the real (structural) OpenCode hook
// shapes. No live OpenCode needed.

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

let definition, parseCommandFile;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.mjs'));
  const mod = await import(url);
  definition = mod.default;
  // The frontmatter parser used to be exported from the plugin module itself.
  // OpenCode's legacy loader treats every exported function as a plugin and
  // tried to invoke it with the plugin context object, which crashed. The
  // parser now lives in its own .cjs sibling; require it directly.
  parseCommandFile = require(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail-frontmatter.cjs')).parseCommandFile;
});

// --- V2 (default export object: id + setup, V1 fallback via server()) ------

function makeV2Ctx() {
  const reg = { commands: [], skills: [], contextHook: null, prompts: [] };
  const ctx = {
    command: { transform: async (fn) => fn({ add: (c) => reg.commands.push(c) }) },
    skill: { transform: async (fn) => fn({ add: (s) => reg.skills.push(s) }) },
    session: {
      hook: async (name, cb) => {
        if (name === 'context') reg.contextHook = cb;
      },
      prompt: async (input) => {
        reg.prompts.push(input);
      },
    },
  };
  return { ctx, reg };
}

function v2Command(reg, name) {
  const command = reg.commands.find((c) => c.name === name);
  assert.ok(command, `/${name} command not registered`);
  return command;
}

test('default export is a V2 definition with the V1 server() beside it', async () => {
  assert.equal(definition.id, 'ponytail');
  assert.equal(typeof definition.setup, 'function');
  assert.equal(typeof definition.server, 'function');
});

test('V2 setup registers commands, skills, and the context hook', async () => {
  const { ctx, reg } = makeV2Ctx();
  await definition.setup(ctx);
  for (const expected of ['ponytail', 'ponytail-help', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain']) {
    v2Command(reg, expected);
  }
  assert.ok(reg.commands.every((c) => typeof c.description === 'string' && typeof c.execute === 'function'));
  const skill = reg.skills.find((s) => s.id === 'ponytail');
  assert.ok(skill, 'ponytail skill not registered');
  assert.equal(skill.name, 'ponytail');
  assert.match(skill.description, /laziest solution/i);
  assert.ok(skill.location === undefined && skill.path.endsWith('SKILL.md'));
  assert.ok(skill.content.length > 0);
  assert.equal(typeof reg.contextHook, 'function');
});

test('V2 context hook injects the ruleset at the default mode (full)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const { ctx, reg } = makeV2Ctx();
  await definition.setup(ctx);
  const event = { system: [] };
  await reg.contextHook(event);
  assert.equal(event.system.length, 1);
  assert.equal(event.system[0].type, 'text');
  assert.match(event.system[0].text, /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(event.system[0].text, /lazy senior developer/);
});

test('V2 /ponytail command persists ultra, context hook follows it', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const { ctx, reg } = makeV2Ctx();
  await definition.setup(ctx);
  await v2Command(reg, 'ponytail').execute({ sessionID: 's', prompt: { text: 'ultra' }, delivery: 'queue' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  assert.equal(reg.prompts.length, 1);
  assert.match(reg.prompts[0].text, /Switch to ponytail ultra mode/);
  const event = { system: [] };
  await reg.contextHook(event);
  assert.match(event.system[0].text, /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('V2 /ponytail off persists off and the context hook injects nothing', async () => {
  const { ctx, reg } = makeV2Ctx();
  await definition.setup(ctx);
  await v2Command(reg, 'ponytail').execute({ sessionID: 's', prompt: { text: 'off' }, delivery: 'queue' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  const event = { system: [] };
  await reg.contextHook(event);
  assert.deepEqual(event.system, []);
});

test('V2 unsupported /ponytail arguments do not reset the current mode', async () => {
  fs.writeFileSync(statePath, 'ultra');
  const { ctx, reg } = makeV2Ctx();
  await definition.setup(ctx);
  await v2Command(reg, 'ponytail').execute({ sessionID: 's', prompt: { text: 'status' }, delivery: 'queue' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('V2 template commands submit the shipped template text', async () => {
  const { ctx, reg } = makeV2Ctx();
  await definition.setup(ctx);
  await v2Command(reg, 'ponytail-review').execute({ sessionID: 's', prompt: { text: '' }, delivery: 'queue' });
  assert.equal(reg.prompts.length, 1);
  assert.match(reg.prompts[0].text, /Review the current code changes for over-engineering/);
});

// --- V1 (OpenCode 1.x server()) ----------------------------------------------

const loadV1 = () => definition.server({});

function transform(hooks) {
  const output = { system: [] };
  return hooks['experimental.chat.system.transform']({ model: {} }, output).then(() => output.system);
}

test('system.transform injects the ruleset at the default mode (full)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadV1();
  const system = await transform(hooks);
  assert.equal(system.length, 1);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(system[0], /lazy senior developer/);
});

test('command.execute.before persists /ponytail ultra, transform follows it', async () => {
  const hooks = await loadV1();
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'ultra', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  const system = await transform(hooks);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('/ponytail off persists off and transform injects nothing', async () => {
  const hooks = await loadV1();
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'off', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  const system = await transform(hooks);
  assert.deepEqual(system, []);
});

test('system.transform merges into existing system entry (Qwen compat, #296)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadV1();
  const output = { system: ['You are a helpful assistant.'] };
  await hooks['experimental.chat.system.transform']({ model: {} }, output);
  assert.equal(output.system.length, 1, 'must not add a second system entry');
  assert.match(output.system[0], /You are a helpful assistant/);
  assert.match(output.system[0], /PONYTAIL MODE ACTIVE/);
});

test('unsupported /ponytail arguments do not reset the current mode', async () => {
  const hooks = await loadV1();
  fs.writeFileSync(statePath, 'ultra');
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'status', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('unrelated commands do not touch the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadV1();
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

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
