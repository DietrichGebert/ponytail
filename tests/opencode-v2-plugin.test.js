#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');

let plugin;
test.before(async () => {
  delete process.env.PONYTAIL_DEFAULT_MODE;
  plugin = (await import('@dietrichgebert/ponytail/v2')).default;
});

function context() {
  const commands = new Map();
  const skills = [];
  const hooks = {};
  const prompts = [];
  return {
    commands,
    skills,
    hooks,
    prompts,
    value: {
      command: {
        transform: async (callback) => callback({
          add(command) { commands.set(command.name, command); },
        }),
      },
      skill: {
        transform: async (callback) => callback({ add: (skill) => skills.push(skill) }),
      },
      session: {
        hook: async (name, callback) => { hooks[name] = callback; },
        prompt: async (prompt) => { prompts.push(prompt); },
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
  assert.equal(typeof ctx.commands.get('ponytail').execute, 'function');
  assert.ok(ctx.skills.some((skill) => skill.id === 'ponytail'));
  assert.ok(ctx.skills.some((skill) => skill.id === 'ponytail-review'));
  assert.match(ctx.skills.find((skill) => skill.id === 'ponytail').description, /laziest solution/);
});

test('executes commands through the V2 session prompt API', async () => {
  const ctx = context();
  await plugin.setup(ctx.value);
  await ctx.commands.get('ponytail').execute({
    sessionID: 'session-1',
    prompt: { text: 'ultra', files: [{ id: 'attachment' }] },
    delivery: 'queue',
  });
  assert.equal(ctx.prompts.length, 1);
  assert.equal(ctx.prompts[0].sessionID, 'session-1');
  assert.equal(ctx.prompts[0].delivery, 'queue');
  assert.deepEqual(ctx.prompts[0].files, [{ id: 'attachment' }]);
  assert.match(ctx.prompts[0].text, /Switch to ponytail ultra mode/);
  assert.doesNotMatch(ctx.prompts[0].text, /\$ARGUMENTS/);
});

test('appends arguments when a command template has no placeholder', async () => {
  const ctx = context();
  await plugin.setup(ctx.value);
  await ctx.commands.get('ponytail-review').execute({
    sessionID: 'session-1',
    prompt: { text: 'focus on staged files' },
    delivery: 'steer',
  });
  assert.match(ctx.prompts[0].text, /\n\nfocus on staged files$/);
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
