#!/usr/bin/env node
// Smoke test for the OpenCode adapter: the plugin's hooks behave against the
// real (structural) OpenCode hook shapes. No live OpenCode needed.

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

let loadPlugin, parseCommandFile, parseSkillFile;
test.before(async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.mjs'));
  const mod = await import(url);
  loadPlugin = mod.default;
  // The frontmatter parser used to be exported from the plugin module itself.
  // OpenCode's legacy loader treats every exported function as a plugin and
  // tried to invoke it with the plugin context object, which crashed. The
  // parser now lives in its own .cjs sibling; require it directly.
  const parser = require(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail-frontmatter.cjs'));
  parseCommandFile = parser.parseCommandFile;
  parseSkillFile = parser.parseSkillFile;
});

test('plugin module exposes only the default export (regression guard for #631, #301)', async () => {
  const url = pathToFileURL(path.join(__dirname, '..', '.opencode', 'plugins', 'ponytail.mjs'));
  const mod = await import(url);
  const namedExports = Object.keys(mod).filter((k) => k !== 'default');
  assert.deepEqual(
    namedExports,
    [],
    'ponytail.mjs must not have named exports: OpenCode\'s legacy getLegacyPlugins() ' +
    'loader calls every exported function as a plugin factory'
  );
});

// ---------------------------------------------------------------- V2 ------
// The V2 half of the default export: a definition object, not a function. V2
// rejects the V1 function shape outright, so this is the whole load contract.
test('default export is a V2 definition with id + setup, and a V1 server()', () => {
  assert.equal(typeof loadPlugin, 'object', 'V2 needs an object, not the V1 plugin function');
  assert.equal(loadPlugin.id, 'ponytail');
  assert.equal(typeof loadPlugin.setup, 'function');
  assert.equal(typeof loadPlugin.server, 'function', 'V1 OpenCode still calls server()');
});

// Minimal structural stand-in for the V2 plugin context. No live OpenCode: the
// editors and the hook are plain callbacks, so the registered state is just
// what the plugin handed them.
function setupV2(overrides = {}) {
  const added = { skills: [], commands: [] };
  const prompts = [];
  const hooks = {};
  const ctx = {
    skill: { transform: async (cb) => cb({ add: (s) => added.skills.push(s) }) },
    command: {
      transform: async (cb) =>
        cb({
          add: (c) => {
            added.commands.push(c);
            added.commands[c.name] = c; // callable by name
          },
        }),
    },
    session: {
      prompt: async (input) => prompts.push(input),
      hook: async (name, cb) => (hooks[name] = cb),
    },
    ...overrides,
  };
  return loadPlugin.setup(ctx).then(() => ({ added, prompts, hooks }));
}

test('V2 setup registers all six commands and all six skills', async () => {
  const { added } = await setupV2();
  assert.deepEqual(
    added.commands.map((c) => c.name).sort(),
    ['ponytail', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help', 'ponytail-review'],
  );
  assert.equal(added.skills.length, 6);
  for (const skill of added.skills) {
    // V2 rejects a skill without these (Skill.Info: id, name, path, content).
    assert.ok(skill.id && skill.name && skill.path && skill.content, `incomplete skill ${skill.id}`);
    assert.equal(skill.id, path.basename(path.dirname(skill.path)), 'id is the skill directory name');
  }
});

test('V2 skill transform matches what OpenCode derives from the same SKILL.md', async () => {
  const { added } = await setupV2();
  const ponytail = added.skills.find((s) => s.id === 'ponytail');
  const source = parseSkillFile(path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md'));
  assert.equal(ponytail.description, source.description);
  assert.ok(ponytail.description.startsWith('Forces the laziest solution'), 'folded > block joined');
  assert.ok(ponytail.description.endsWith('\n'), 'YAML closes a folded scalar with a newline');
  assert.ok(!ponytail.description.includes('argument-hint'), 'block scalar stops at the next key');
  assert.equal(ponytail.content, source.body);
  assert.ok(!ponytail.content.includes('description:'), 'content is the body, frontmatter stripped');
});

test('V2 /ponytail ultra persists the level and sends the template with the args', async () => {
  const { added, prompts } = await setupV2();
  await added.commands.ponytail.execute({ sessionID: 's', prompt: { text: 'ultra' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].sessionID, 's');
  assert.equal(prompts[0].delivery, 'steer');
  assert.match(prompts[0].text, /^Switch to ponytail ultra mode\./);
  assert.ok(!prompts[0].text.includes('$ARGUMENTS'), 'template placeholder substituted');
});

test('V2 context hook injects the ruleset, and stays silent when off', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  let { hooks } = await setupV2();
  const event = { system: [] };
  await hooks.context(event);
  assert.equal(event.system.length, 1);
  assert.equal(event.system[0].type, 'text', 'V2 system entries are typed parts');
  assert.match(event.system[0].text, /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(event.system[0].text, /lazy senior developer/);

  const { added } = await setupV2();
  await added.commands.ponytail.execute({ sessionID: 's', prompt: { text: 'off' }, delivery: 'steer' });
  ({ hooks } = await setupV2());
  const quiet = { system: [] };
  await hooks.context(quiet);
  assert.deepEqual(quiet.system, []);
});

test('V2 unsupported /ponytail arguments do not reset the current mode', async () => {
  const { added } = await setupV2();
  fs.writeFileSync(statePath, 'ultra');
  await added.commands.ponytail.execute({ sessionID: 's', prompt: { text: 'status' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('V2 bare /ponytail keeps a running level and switches an off session on (#639)', async () => {
  const { added } = await setupV2();
  fs.writeFileSync(statePath, 'ultra');
  await added.commands.ponytail.execute({ sessionID: 's', prompt: { text: '' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra', 'checking the level must not reset ultra');

  fs.writeFileSync(statePath, 'off');
  await added.commands.ponytail.execute({ sessionID: 's', prompt: { text: '' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'full');
});

test('V1 and V2 share one mode file, so a level set under either API applies to both', async () => {
  const { added } = await setupV2();
  await added.commands.ponytail.execute({ sessionID: 's', prompt: { text: 'lite' }, delivery: 'steer' });
  const v1 = await loadPlugin.server({});
  const output = { system: [] };
  await v1['experimental.chat.system.transform']({ model: {} }, output);
  assert.match(output.system.join(''), /PONYTAIL MODE ACTIVE — level: lite/);

  // ...and the reverse: a level set by the V1 hook reaches the V2 injection.
  await v1['command.execute.before']({ command: 'ponytail', arguments: 'ultra', sessionID: 's' });
  const { hooks } = await setupV2();
  const event = { system: [] };
  await hooks.context(event);
  assert.match(event.system[0].text, /PONYTAIL MODE ACTIVE — level: ultra/);
});

// ---------------------------------------------------------------- V1 ------

function transform(hooks) {
  const output = { system: [] };
  return hooks['experimental.chat.system.transform']({ model: {} }, output).then(() => output.system);
}

test('system.transform injects the ruleset at the default mode (full)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin.server({});
  const system = await transform(hooks);
  assert.equal(system.length, 1);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: full/);
  assert.match(system[0], /lazy senior developer/);
});

test('command.execute.before persists /ponytail ultra, transform follows it', async () => {
  const hooks = await loadPlugin.server({});
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'ultra', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
  const system = await transform(hooks);
  assert.match(system[0], /PONYTAIL MODE ACTIVE — level: ultra/);
});

test('/ponytail off persists off and transform injects nothing', async () => {
  const hooks = await loadPlugin.server({});
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'off', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'off');
  const system = await transform(hooks);
  assert.deepEqual(system, []);
});

test('system.transform merges into existing system entry (Qwen compat, #296)', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin.server({});
  const output = { system: ['You are a helpful assistant.'] };
  await hooks['experimental.chat.system.transform']({ model: {} }, output);
  assert.equal(output.system.length, 1, 'must not add a second system entry');
  assert.match(output.system[0], /You are a helpful assistant/);
  assert.match(output.system[0], /PONYTAIL MODE ACTIVE/);
});

test('unsupported /ponytail arguments do not reset the current mode', async () => {
  const hooks = await loadPlugin.server({});
  fs.writeFileSync(statePath, 'ultra');
  await hooks['command.execute.before']({ command: 'ponytail', arguments: 'status', sessionID: 's' });
  assert.equal(fs.readFileSync(statePath, 'utf8'), 'ultra');
});

test('unrelated commands do not touch the flag', async () => {
  try { fs.unlinkSync(statePath); } catch (e) {}
  const hooks = await loadPlugin.server({});
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

test('parseSkillFile folds >, keeps | lines, and stops at the next key', () => {
  const file = path.join(tmp, 'skill.md');
  fs.writeFileSync(
    file,
    '---\nname: demo\ndescription: >\n  one two\n  three four\nargument-hint: "[a]"\nlicense: MIT\n---\nBODY\n',
  );
  assert.deepEqual(parseSkillFile(file), {
    name: 'demo',
    description: 'one two three four\n',
    body: 'BODY\n',
  });

  // Plain scalar stays as written, and a literal block keeps its newlines.
  fs.writeFileSync(file, '---\nname: demo\ndescription: plain\n---\nB\n');
  assert.equal(parseSkillFile(file).description, 'plain');
  fs.writeFileSync(file, '---\ndescription: |\n  line one\n  line two\n---\nB\n');
  assert.equal(parseSkillFile(file).description, 'line one\nline two\n');
  // Chomping indicator drops the closing newline.
  fs.writeFileSync(file, '---\ndescription: >-\n  stripped\n---\nB\n');
  assert.equal(parseSkillFile(file).description, 'stripped');

  // CRLF: a Windows checkout must parse the same as the npm \n build.
  fs.writeFileSync(file, '---\r\nname: demo\r\ndescription: >\r\n  crlf text\r\n---\r\nBODY\r\n');
  assert.deepEqual(parseSkillFile(file), { name: 'demo', description: 'crlf text\n', body: 'BODY\r\n' });

  fs.writeFileSync(file, 'no frontmatter here\n');
  assert.equal(parseSkillFile(file), null);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
