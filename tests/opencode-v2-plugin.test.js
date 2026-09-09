#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');

let plugin;
let decodePrompt, decodeSystem;
test.before(async () => {
  process.env.PONYTAIL_DEFAULT_MODE = 'full';
  const { Schema } = await import('effect');
  const { Prompt } = await import('@opencode/schema/prompt-input');
  const { SystemPart } = await import('@opencode/ai/schema/messages');
  decodePrompt = Schema.decodeUnknownSync(Prompt);
  decodeSystem = Schema.decodeUnknownSync(Schema.Array(SystemPart));
  plugin = (await import('@dietrichgebert/ponytail/v2')).default;
});

function context(storage = new Map()) {
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
      storage: {
        get: async (key) => storage.get(key),
        set: async (key, value) => { storage.set(key, value); },
      },
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
        prompt: async (prompt) => { decodePrompt(prompt); prompts.push(prompt); },
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
    prompt: { text: 'ultra', files: [{ uri: 'file:///example.txt' }] },
    delivery: 'queue',
  });
  assert.equal(ctx.prompts.length, 1);
  assert.equal(ctx.prompts[0].sessionID, 'session-1');
  assert.equal(ctx.prompts[0].delivery, 'queue');
  assert.deepEqual(ctx.prompts[0].files, [{ uri: 'file:///example.txt' }]);
  assert.match(ctx.prompts[0].text, /level: ultra/);
  assert.doesNotMatch(ctx.prompts[0].text, /\$ARGUMENTS/);
});

test('mode switches apply to the same request, later turns, and only that session', async () => {
  const storage = new Map();
  let ctx = context(storage);
  await plugin.setup(ctx.value);
  for (const mode of ['ultra', 'off', 'lite']) {
    await ctx.commands.get('ponytail').execute({
      sessionID: 'session-1', prompt: { text: mode }, delivery: 'steer',
    });
    for (let turn = 0; turn < 2; turn++) {
      const event = { sessionID: 'session-1', system: [] };
      await ctx.hooks.context(event);
      decodeSystem(event.system);
      if (mode === 'off') assert.deepEqual(event.system, []);
      else assert.match(event.system[0].text, new RegExp(`level: ${mode}`));
    }
    const other = { sessionID: 'session-2', system: [] };
    await ctx.hooks.context(other);
    assert.match(other.system[0].text, /level: full/);
  }
  ctx = context(storage);
  await plugin.setup(ctx.value);
  const resumed = { sessionID: 'session-1', system: [] };
  await ctx.hooks.context(resumed);
  assert.match(resumed.system[0].text, /level: lite/);
});

test('status, invalid arguments, and review preserve the selected mode', async () => {
  const ctx = context();
  await plugin.setup(ctx.value);
  const execute = (text) => ctx.commands.get('ponytail').execute({
    sessionID: 'session-1', prompt: { text }, delivery: 'queue',
  });
  await execute('  ULTRA  ');
  await execute('');
  assert.match(ctx.prompts.at(-1).text, /level: ultra/);
  await execute('ulta');
  assert.match(ctx.prompts.at(-1).text, /Invalid.*lite.*full.*ultra.*off/);
  await ctx.commands.get('ponytail-review').execute({
    sessionID: 'session-1', prompt: { text: '' }, delivery: 'queue',
  });
  const event = { sessionID: 'session-1', system: [] };
  await ctx.hooks.context(event);
  assert.match(event.system[0].text, /level: ultra/);
});

test('expanded prompts preserve references without stale mention offsets or mutation', async () => {
  const ctx = context();
  await plugin.setup(ctx.value);
  const prompt = {
    text: '@file @build @skill',
    files: [{ uri: 'file:///example.txt', mention: { start: 0, end: 5, text: '@file' } }],
    agents: [{ name: 'build', mention: { start: 6, end: 12, text: '@build' } }],
    skills: [{ id: 'ponytail-review', mention: { start: 13, end: 19, text: '@skill' } }],
  };
  const original = structuredClone(prompt);
  await ctx.commands.get('ponytail-review').execute({ sessionID: 'session-1', prompt, delivery: 'queue' });
  const submitted = ctx.prompts.at(-1);
  for (const key of ['files', 'agents', 'skills']) {
    assert.equal(submitted[key][0].mention, undefined);
    const { mention, ...reference } = prompt[key][0];
    assert.deepEqual(submitted[key][0], reference);
  }
  assert.deepEqual(prompt, original);
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
