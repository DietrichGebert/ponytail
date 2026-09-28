#!/usr/bin/env node
// Smoke test for the OpenCode 2.x adapter against a mock of the V2 plugin
// Context (@opencode/plugin 2.0.x `Context`): hooks must be registered through
// ctx.session.hook / ctx.command.transform / ctx.skill.transform, and setup()
// may only return a cleanup function. No live OpenCode needed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

// Point the mode flag at a temp config home BEFORE the plugin loads (see
// opencode-plugin.test.js).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-opencode-v2-'));
process.env.XDG_CONFIG_HOME = tmp;
delete process.env.PONYTAIL_DEFAULT_MODE;
const statePath = path.join(tmp, 'opencode', '.ponytail-active');

let plugin, parseSkillFile;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail-v2.mjs'));
  plugin = (await import(url)).default;
  parseSkillFile = require(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail-frontmatter.cjs')).parseSkillFile;
});

// Records what the plugin registers, in the shape the V2 host exposes.
function mockContext() {
  const registered = { hooks: {}, commands: {}, skills: {}, prompts: [], disposed: 0 };
  const registration = () => ({ dispose: async () => { registered.disposed++; } });
  const ctx = {
    session: {
      hook: async (name, callback) => { registered.hooks[name] = callback; return registration(); },
      prompt: async (input) => { registered.prompts.push(input); },
    },
    command: {
      transform: async (callback) => {
        callback({ add: (definition) => { registered.commands[definition.name] = definition; } });
        return registration();
      },
    },
    skill: {
      transform: async (callback) => {
        callback({
          get: (id) => registered.skills[id],
          add: (skill) => { registered.skills[skill.id] = skill; },
        });
        return registration();
      },
    },
  };
  return { ctx, registered };
}

async function setup() {
  const { ctx, registered } = mockContext();
  const cleanup = await plugin.setup(ctx);
  return { registered, cleanup };
}

async function context(registered) {
  const event = { sessionID: 's', agent: 'explore', system: [{ type: 'text', text: 'You are a helpful assistant.' }] };
  await registered.hooks.context(event);
  return event.system;
}

test('default export is a V2 plugin definition', () => {
  assert.equal(plugin.id, 'ponytail');
  assert.equal(typeof plugin.setup, 'function');
});

test('setup registers through the context and returns only a cleanup function', async () => {
  const { registered, cleanup } = await setup();
  assert.deepEqual(Object.keys(registered.hooks), ['context']);
  assert.equal(typeof cleanup, 'function');
  await cleanup();
  assert.equal(registered.disposed, 3);
});

test('context hook appends the ruleset at the default mode (full) as a system part', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const { registered } = await setup();
  const system = await context(registered);
  assert.equal(system.length, 2);
  assert.equal(system[0].text, 'You are a helpful assistant.');
  assert.equal(system[1].type, 'text');
  assert.match(system[1].text, /PONYTAIL MODE ACTIVE — level: full/);
});

test('/ponytail ultra persists the mode, applies this turn and sends the template', async () => {
  const { registered } = await setup();
  await registered.commands.ponytail.execute({ sessionID: 's1', prompt: { text: 'ultra' } });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  assert.match((await context(registered))[1].text, /PONYTAIL MODE ACTIVE — level: ultra/);
  assert.equal(registered.prompts.length, 1);
  assert.equal(registered.prompts[0].sessionID, 's1');
  assert.match(registered.prompts[0].text, /Switch to ponytail ultra mode/);
});

test('/ponytail accepts the raw input line with the command name', async () => {
  const { registered } = await setup();
  await registered.commands.ponytail.execute({ sessionID: 's', prompt: { text: '/ponytail lite' } });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'lite');
});

test('/ponytail off persists off and the context hook injects nothing', async () => {
  const { registered } = await setup();
  await registered.commands.ponytail.execute({ sessionID: 's', prompt: { text: 'off' } });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  assert.equal((await context(registered)).length, 1);
});

test('unsupported /ponytail arguments do not reset the current mode', async () => {
  fs.writeFileSync(statePath, 'ultra');
  const { registered } = await setup();
  await registered.commands.ponytail.execute({ sessionID: 's', prompt: { text: 'status' } });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('other commands send their template without touching the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const { registered } = await setup();
  assert.ok(registered.commands['ponytail-review'].description);
  await registered.commands['ponytail-review'].execute({ sessionID: 's', prompt: { text: '' } });
  assert.equal(fs.existsSync(statePath), false);
  assert.equal(registered.prompts.length, 1);
  assert.ok(registered.prompts[0].text.length > 0);
});

test('bundled skills are registered with name, description and content', async () => {
  const { registered } = await setup();
  const skill = registered.skills['ponytail-audit'];
  assert.equal(skill.name, 'ponytail-audit');
  assert.match(skill.description, /^Whole-repo audit for over-engineering\./);
  assert.ok(skill.content.length > 0);
  assert.ok(path.isAbsolute(skill.path));
  assert.ok(registered.skills.ponytail);
});

test('parseSkillFile reads one-line and folded descriptions', () => {
  const inline = path.join(tmp, 'inline.md');
  fs.writeFileSync(inline, '---\nname: a\ndescription: short one\n---\n\nbody\n');
  assert.deepEqual(parseSkillFile(inline), { name: 'a', description: 'short one', content: 'body' });

  const folded = path.join(tmp, 'folded.md');
  fs.writeFileSync(folded, '---\r\nname: b\r\ndescription: >\r\n  first line\r\n  second line\r\nother: x\r\n---\r\nbody\r\n');
  assert.deepEqual(parseSkillFile(folded), { name: 'b', description: 'first line second line', content: 'body' });
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
