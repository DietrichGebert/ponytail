#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let plugin;
test.before(async () => {
  delete process.env.PONYTAIL_DEFAULT_MODE;
  plugin = (await import('@dietrichgebert/ponytail/v2')).default;
});

function context(style = 'add') {
  const commands = new Map();
  const skills = [];
  const hooks = {};
  return {
    commands,
    skills,
    hooks,
    value: {
      command: {
        transform: async (callback) => callback({
          update(name, update) {
            const command = { name, template: '' };
            update(command);
            commands.set(name, command);
          },
        }),
      },
      skill: {
        transform: async (callback) => callback(style === 'source'
          ? { source: (source) => skills.push(source) }
          : { add: (skill) => skills.push(skill) }),
      },
      session: {
        hook: async (name, callback) => { hooks[name] = callback; },
      },
    },
  };
}

test('exports the V2 id/setup contract and registers commands and beta skills', async () => {
  assert.equal(plugin.id, 'ponytail');
  assert.equal(typeof plugin.setup, 'function');
  const ctx = context();
  await plugin.setup(ctx.value);
  assert.ok(ctx.commands.has('ponytail'));
  assert.ok(ctx.commands.has('ponytail-review'));
  assert.match(ctx.commands.get('ponytail').template, /Switch to ponytail/);
  assert.ok(ctx.skills.some((skill) => skill.id === 'ponytail'));
  assert.ok(ctx.skills.some((skill) => skill.id === 'ponytail-review'));
  assert.match(ctx.skills.find((skill) => skill.id === 'ponytail').description, /laziest solution/);
});

test('uses the documented V2 skill source draft when available', async () => {
  const ctx = context('source');
  await plugin.setup(ctx.value);
  assert.deepEqual(ctx.skills, [{
    type: 'directory',
    path: path.resolve(__dirname, '..', 'skills'),
  }]);
});

test('context hook preserves one system entry for Qwen compatibility', async () => {
  const ctx = context();
  await plugin.setup(ctx.value);
  const event = { system: [{ type: 'text', text: 'Existing system prompt.' }] };
  await ctx.hooks.context(event);
  assert.equal(event.system.length, 1);
  assert.match(event.system[0].text, /Existing system prompt/);
  assert.match(event.system[0].text, /PONYTAIL MODE ACTIVE/);
});

test('context hook creates a SystemPart when the system is empty', async () => {
  const ctx = context();
  await plugin.setup(ctx.value);
  const event = { system: [] };
  await ctx.hooks.context(event);
  assert.equal(event.system.length, 1);
  assert.equal(event.system[0].type, 'text');
  assert.match(event.system[0].text, /level: full/);
});
