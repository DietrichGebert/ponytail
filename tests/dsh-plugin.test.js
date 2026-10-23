#!/usr/bin/env node
// The DeepSeek Harness adapter mounts the repo's own skills and hooks through a
// Cordis bundle. These tests hold the two things that can silently break:
//   - a registration that is not owned by the plugin's fiber survives uninstall
//     and keeps injecting the ruleset (verified live on 2026-10-23: without the
//     teardown effect, removing the bundle left the section registered and the
//     reinstall failed with `prompt section "ponytail" is already registered`),
//   - `/ponytail off` that only reports a level instead of disposing the
//     section, because assemble() keeps sections whose text renders empty.
// Run with the rest of the suite: npm test.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const ADAPTER = path.join(root, '.dsh-plugin', 'index.js');
const LOG = path.join(root, '.dsh-plugin', '.test.log');

/** The smallest Host that satisfies the plugin, with real disposal semantics. */
function fakeHost() {
  const state = { skills: [], commands: [], listeners: new Map(), sections: [], effects: [], disposals: 0 };
  const scope = {
    systemPrompt: {
      section(section) {
        state.sections.push(section);
        let live = true;
        return () => {
          if (!live) return;
          live = false;
          state.disposals += 1;
          const at = state.sections.indexOf(section);
          if (at >= 0) state.sections.splice(at, 1);
        };
      },
    },
    on(event, listener) {
      if (!state.listeners.has(event)) state.listeners.set(event, []);
      state.listeners.get(event).push(listener);
    },
  };
  const ctx = {
    skills: { register: (skill) => (state.skills.push(skill), () => {}) },
    commands: { register: (definition) => (state.commands.push(definition), () => {}) },
    on: scope.on,
    effect: (action) => {
      const dispose = action();
      if (typeof dispose === 'function') state.effects.push(dispose);
      return () => {};
    },
    get: () => undefined,
  };
  return { ctx, state, scope };
}

/** Mount the adapter on a fake Host and deliver agent/created to it. */
async function mount(defaultMode = 'full') {
  const plugin = await import(pathToFileURL(ADAPTER).href);
  const host = fakeHost();
  plugin.apply(host.ctx, { defaultMode, logPath: LOG });
  const agent = { id: 's1', ctx: host.scope };
  for (const listener of host.state.listeners.get('agent/created') ?? []) listener({ agent });
  return { plugin, ...host, agent };
}

function runCommand(state, agent, line) {
  const definition = state.commands.find((command) => command.name === 'ponytail');
  assert.ok(definition, 'the /ponytail command must be registered');
  return definition.handler({
    commandId: 'c1',
    agent,
    rawInput: line,
    attachments: [],
    signal: new AbortController().signal,
  });
}

test.after(() => fs.rmSync(LOG, { force: true }));

test('the adapter ships the files a DSH bundle needs', () => {
  for (const file of ['index.js', 'cordis.patch.yml', 'package.json', 'plugin.json']) {
    assert.ok(fs.existsSync(path.join(root, '.dsh-plugin', file)), `.dsh-plugin/${file} is missing`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.dsh-plugin', 'plugin.json'), 'utf8'));
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.version, rootPkg.version, '.dsh-plugin/plugin.json version must match package.json');
  const bundle = JSON.parse(fs.readFileSync(path.join(root, '.dsh-plugin', 'package.json'), 'utf8'));
  assert.ok(bundle.dsh && bundle.dsh.bundle && bundle.dsh.bundle.patch, 'the bundle must declare dsh.bundle.patch');
});

test('the six skills are registered from this repo, with bodies', async () => {
  const plugin = await import(pathToFileURL(ADAPTER).href);
  const skills = plugin.loadSkills();
  assert.equal(skills.length, 6);
  assert.deepEqual(skills.map((skill) => skill.name).sort(), [
    'ponytail',
    'ponytail-audit',
    'ponytail-debt',
    'ponytail-gain',
    'ponytail-help',
    'ponytail-review',
  ]);
  for (const skill of skills) {
    assert.ok(skill.description.length > 40, `${skill.name}: description too short to be listed`);
    assert.ok(skill.content.length > 400, `${skill.name}: body too short`);
    assert.ok(!skill.content.startsWith('---'), `${skill.name}: frontmatter leaked into the body`);
    assert.equal(skill.invocation.userInvocable, true, `${skill.name}: must be user-invocable to work as /${skill.name}`);
  }
});

test('activation registers the skills and exactly one command', async () => {
  const { state } = await mount();
  assert.equal(state.skills.length, 6);
  assert.equal(state.commands.length, 1, 'extra command rows would shadow the skills of the same name');
  assert.equal(state.commands[0].name, 'ponytail');
  assert.equal(state.sections.length, 1, 'agent/created must install the ruleset section');
  assert.equal(state.sections[0].name, 'ponytail');
  assert.match(state.sections[0].text({}), /^PONYTAIL MODE ACTIVE — level: full\n/);
});

test('/ponytail switches the injected ruleset, and off disposes it', async () => {
  const { state, agent } = await mount();
  assert.match(runCommand(state, agent, '').text, /full/, 'no argument reports the current level');
  assert.equal(runCommand(state, agent, 'turbo').kind, 'error', 'an unknown level must be rejected');

  runCommand(state, agent, 'lite');
  assert.match(state.sections[0].text({}), /^PONYTAIL MODE ACTIVE — level: lite\n/);

  const before = state.disposals;
  runCommand(state, agent, 'off');
  assert.equal(state.sections.length, 0, 'off must dispose the section, not blank its text');
  assert.ok(state.disposals > before, 'off must actually dispose a registration');

  runCommand(state, agent, 'full');
  assert.equal(state.sections.length, 1, 'full must restore the section');
});

test('unloading the plugin removes every section it installed', async () => {
  const { state } = await mount();
  assert.equal(state.sections.length, 1);
  assert.equal(state.effects.length, 1, 'the agent-scope registration must also be owned by the plugin fiber');

  for (const disposeEffect of state.effects) disposeEffect();
  assert.equal(state.sections.length, 0, 'uninstall would leave the ruleset injected');
});
