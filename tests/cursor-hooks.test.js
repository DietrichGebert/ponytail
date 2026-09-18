#!/usr/bin/env node
// Cursor adapter compatibility check (#817). The hooks must speak Cursor's
// hooks.json contract: camelCase events, JSON on stdout (empty stdout is a
// no-op, raw text is a parse error), `additional_context` on sessionStart, and
// `continue` plus `additional_context` on beforeSubmitPrompt. The installer must
// merge into an existing hooks.json without touching unrelated hooks.
//
// Input shapes mirror docs/cursor-hooks.md (Cursor docs and the 3.20.17
// client). This checks the adapter's input/output behavior only; whether the
// model actually receives the context is the live session check in that doc.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const rootFwd = root.replace(/\\/g, '/');
const TEMPLATE = 'hooks/cursor-hooks.json';

// Keep host detection and config resolution deterministic whatever shell the
// suite runs in (a Cursor hook env, a Codex shell, a machine-wide default mode).
for (const key of [
  'CURSOR_VERSION', 'CURSOR_PROJECT_DIR', 'CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_CONFIG_DIR', 'PLUGIN_DATA', 'COPILOT_PLUGIN_DATA', 'QODER_SESSION_ID',
  'PONYTAIL_SUBAGENT_MATCHER', 'PONYTAIL_DEFAULT_MODE', 'XDG_CONFIG_HOME',
]) {
  delete process.env[key];
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-cursor-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

function run(script, env, input = '', cwd = undefined) {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input,
    cwd,
    encoding: 'utf8',
  });
}

function cli(args, env, cwd = undefined) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'cursor-hooks.js'), ...args], {
    env: { ...process.env, ...env },
    cwd,
    encoding: 'utf8',
  });
}

function parse(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.startsWith('{'), `expected JSON on stdout, got: ${result.stdout.slice(0, 80)}`);
  return JSON.parse(result.stdout);
}

// A fresh HOME and workspace per case so flag state cannot leak between cases.
// The env is what Cursor 3.20.17 gives a hook process: CURSOR_VERSION and the
// workspace root in CURSOR_PROJECT_DIR (plus its CLAUDE_PROJECT_DIR alias).
function cursorEnv(name, extra = {}) {
  const home = path.join(temp, name, 'home');
  const project = path.join(temp, name, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  return {
    home,
    project,
    flag: path.join(home, '.cursor', '.ponytail-active'),
    env: {
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      CURSOR_VERSION: '3.20.17',
      CURSOR_PROJECT_DIR: project,
      CLAUDE_PROJECT_DIR: project,
      ...extra,
    },
  };
}

function writeFlag(c, mode) {
  fs.mkdirSync(path.dirname(c.flag), { recursive: true });
  fs.writeFileSync(c.flag, mode);
}

test('cursor hooks template is a valid hooks.json with the two events that can inject context', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, TEMPLATE), 'utf8'));
  assert.equal(config.version, 1);
  assert.deepEqual(Object.keys(config.hooks).sort(), ['beforeSubmitPrompt', 'sessionStart']);
  assert.match(config.hooks.sessionStart[0].command, /ponytail-activate\.js/);
  assert.match(config.hooks.beforeSubmitPrompt[0].command, /ponytail-mode-tracker\.js/);
  // subagentStart answers only permission/user_message in Cursor, so it must
  // not be registered: it would cost a process per subagent and inject nothing.
  assert.equal(config.hooks.subagentStart, undefined);
  for (const entries of Object.values(config.hooks)) {
    assert.ok(Array.isArray(entries) && entries.length === 1);
    for (const entry of entries) {
      assert.match(entry.command, /^node "PONYTAIL_DIR\/hooks\/ponytail-[\w-]+\.js"$/, 'plain node call, quoted absolute path');
      assert.doesNotMatch(entry.command, /(^|\s)exec\s|&&|\|\|/, 'must run under cmd, PowerShell and bash alike');
      assert.equal(typeof entry.timeout, 'number');
      const script = entry.command.match(/hooks\/([\w.-]+\.js)/)[1];
      assert.ok(fs.existsSync(path.join(root, 'hooks', script)), `command references a missing hook script: ${script}`);
    }
  }
});

test('isCursor is off outside a Cursor hook process', () => {
  const { isCursor } = require('../hooks/ponytail-runtime');
  assert.equal(isCursor, false);
});

test('sessionStart injects the default-level ruleset as additional_context and keeps state under ~/.cursor', () => {
  const c = cursorEnv('start', { PONYTAIL_DEFAULT_MODE: 'ultra' });
  const input = JSON.stringify({
    hook_event_name: 'sessionStart', conversation_id: 'conv-1', session_id: 'conv-1',
    is_background_agent: false, composer_mode: 'agent', workspace_roots: [c.project],
    cursor_version: '3.20.17', model: 'claude-opus-4-7-thinking-max',
  });
  const output = parse(run('ponytail-activate.js', c.env, input));
  assert.deepEqual(Object.keys(output), ['additional_context']);
  assert.match(output.additional_context, /^PONYTAIL MODE ACTIVE — level: ultra/);
  assert.match(output.additional_context, /YAGNI extremist/, 'ultra row must survive the level filter');
  assert.doesNotMatch(output.additional_context, /Build what's asked/, 'lite row must be filtered out');
  assert.doesNotMatch(output.additional_context, /STATUSLINE SETUP NEEDED/, 'Cursor has no Claude statusline to nudge about');
  assert.equal(fs.readFileSync(path.join(c.home, ".cursor", ".ponytail-active.conv-1"), "utf8"), "ultra");
  assert.equal(fs.existsSync(path.join(c.home, '.claude')), false, 'Cursor state must not land in ~/.claude');
});

test('sessionStart in off mode emits nothing and writes no flag', () => {
  const c = cursorEnv('off', { PONYTAIL_DEFAULT_MODE: 'off' });
  const result = run('ponytail-activate.js', c.env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '', 'empty stdout is a no-op for Cursor; "OK" would be a JSON parse error');
  assert.equal(fs.existsSync(c.flag), false);
});

test('Cursor running a Claude-format plugin (CLAUDE_PLUGIN_ROOT set) still gets Cursor JSON', () => {
  const c = cursorEnv('plugin', { PONYTAIL_DEFAULT_MODE: 'full' });
  const pluginRoot = path.join(c.home, '.cursor', 'plugins', 'ponytail');
  c.env.CLAUDE_PLUGIN_ROOT = pluginRoot;
  c.env.CURSOR_PLUGIN_ROOT = pluginRoot;
  const output = parse(run('ponytail-activate.js', c.env));
  assert.match(output.additional_context, /^PONYTAIL MODE ACTIVE — level: full/);
  assert.equal(fs.readFileSync(c.flag, 'utf8'), 'full');
});

test('beforeSubmitPrompt tracks /ponytail commands and delivers the new level ruleset', () => {
  const c = cursorEnv('switch', { PONYTAIL_DEFAULT_MODE: 'full' });
  writeFlag(c, 'full');

  const sw = parse(run('ponytail-mode-tracker.js', c.env, JSON.stringify({
    hook_event_name: 'beforeSubmitPrompt', conversation_id: 'conv-1',
    prompt: '/ponytail lite', attachments: [],
  })));
  assert.equal(sw.continue, true, 'must never block the prompt');
  assert.equal(sw.user_message, undefined, 'Cursor shows user_message only for blocked prompts');
  assert.match(sw.additional_context, /^PONYTAIL MODE CHANGED — level: lite/);
  assert.match(sw.additional_context, /Build what's asked/, 'Cursor has no /ponytail command, so the level ruleset rides along');
  assert.doesNotMatch(sw.additional_context, /YAGNI extremist/);
  assert.equal(fs.readFileSync(c.flag, 'utf8'), 'lite');

  // Bare /ponytail reports the live level without resetting it.
  const report = parse(run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt: '/ponytail' })));
  assert.deepEqual(report, { continue: true, additional_context: 'PONYTAIL MODE ACTIVE — level: lite' });
  assert.equal(fs.readFileSync(c.flag, 'utf8'), 'lite');

  // /ponytail default persists the default without touching the session level.
  const def = parse(run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt: '/ponytail default ultra' })));
  assert.equal(def.continue, true);
  assert.match(def.additional_context, /PONYTAIL DEFAULT SET — new sessions start in ultra/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(c.home, '.config', 'ponytail', 'config.json'), 'utf8')).defaultMode, 'ultra');
  assert.equal(fs.readFileSync(c.flag, 'utf8'), 'lite');

  // /ponytail off and the plain-language deactivations clear the flag and tell the model.
  const off = parse(run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt: '/ponytail off' })));
  assert.deepEqual(off, { continue: true, additional_context: 'PONYTAIL MODE OFF' });
  assert.equal(fs.existsSync(c.flag), false);

  writeFlag(c, 'full');
  const stop = parse(run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt: 'Stop ponytail.' })));
  assert.equal(stop.additional_context, 'PONYTAIL MODE OFF');
  assert.equal(fs.existsSync(c.flag), false);

  // Ordinary prompts produce no output at all: Cursor treats empty stdout as "carry on".
  writeFlag(c, 'full');
  const plain = run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt: 'add a normal mode toggle next to dark mode' }));
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(plain.stdout, '');
  assert.equal(fs.readFileSync(c.flag, 'utf8'), 'full', 'incidental "normal mode" must not turn ponytail off');
});

test('with the always-on rule in the workspace the hooks step back instead of duplicating the ruleset', () => {
  const c = cursorEnv('rule', { PONYTAIL_DEFAULT_MODE: 'full' });
  const rule = path.join(c.project, '.cursor', 'rules', 'ponytail.mdc');
  fs.mkdirSync(path.dirname(rule), { recursive: true });
  fs.copyFileSync(path.join(root, '.cursor', 'rules', 'ponytail.mdc'), rule);

  const start = parse(run('ponytail-activate.js', c.env));
  assert.match(start.additional_context, /always-on Cursor rule/);
  assert.ok(start.additional_context.includes(rule), 'notice must name the rule file');
  assert.doesNotMatch(start.additional_context, /PONYTAIL MODE ACTIVE/, 'no second copy of the ruleset');
  assert.equal(fs.existsSync(c.flag), false, 'no mode flag while the rule owns the ruleset');

  for (const prompt of ['/ponytail ultra', '/ponytail off', 'normal mode', '/ponytail']) {
    const out = parse(run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt })));
    assert.equal(out.continue, true);
    assert.match(out.additional_context, /always-on Cursor rule/, `${prompt} must answer with the rule notice`);
    assert.doesNotMatch(out.additional_context, /PONYTAIL MODE (CHANGED|OFF|ACTIVE)/);
    assert.equal(fs.existsSync(c.flag), false);
  }

  const plain = run('ponytail-mode-tracker.js', c.env, JSON.stringify({ prompt: 'hello' }));
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(plain.stdout, '', 'ordinary prompts stay silent');

  // Project hooks run from the workspace root: the cwd fallback must find the rule too.
  delete c.env.CURSOR_PROJECT_DIR;
  delete c.env.CLAUDE_PROJECT_DIR;
  const viaCwd = parse(run('ponytail-activate.js', c.env, '', c.project));
  assert.match(viaCwd.additional_context, /always-on Cursor rule/);
});

test('installer merges into an existing ~/.cursor/hooks.json and leaves unrelated hooks alone', () => {
  const home = path.join(temp, 'install', 'home');
  fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });
  const file = path.join(home, '.cursor', 'hooks.json');
  const theirs = {
    version: 1,
    hooks: {
      sessionStart: [{ command: './hooks/their-session.sh' }],
      afterFileEdit: [{ command: './hooks/format.sh', matcher: 'Write' }],
    },
  };
  fs.writeFileSync(file, JSON.stringify(theirs));
  const env = { HOME: home, USERPROFILE: home };

  let result = cli(['install'], env);
  assert.equal(result.status, 0, result.stderr);
  let config = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(config.version, 1);
  assert.deepEqual(config.hooks.afterFileEdit, theirs.hooks.afterFileEdit);
  assert.equal(config.hooks.sessionStart[0].command, './hooks/their-session.sh', 'their sessionStart hook stays first and intact');
  assert.equal(config.hooks.sessionStart.length, 2);
  assert.deepEqual(config.hooks.sessionStart[1], { command: `node "${rootFwd}/hooks/ponytail-activate.js"`, timeout: 5 });
  assert.deepEqual(config.hooks.beforeSubmitPrompt, [{ command: `node "${rootFwd}/hooks/ponytail-mode-tracker.js"`, timeout: 5 }]);

  // Idempotent: a second install replaces ponytail's entries, never duplicates them.
  result = cli(['install'], env);
  assert.equal(result.status, 0, result.stderr);
  config = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(config.hooks.sessionStart.length, 2);
  assert.equal(config.hooks.beforeSubmitPrompt.length, 1);

  // Uninstall removes only ponytail's entries.
  result = cli(['uninstall'], env);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), theirs);
});

test('installer creates the file when absent and removes it again when only ponytail lived there', () => {
  const home = path.join(temp, 'fresh', 'home');
  fs.mkdirSync(home, { recursive: true });
  const env = { HOME: home, USERPROFILE: home };
  const file = path.join(home, '.cursor', 'hooks.json');

  let result = cli(['install'], env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Installed ponytail hooks in /);
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(config.version, 1);
  assert.deepEqual(Object.keys(config.hooks).sort(), ['beforeSubmitPrompt', 'sessionStart']);

  result = cli(['uninstall'], env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(file), false);

  // Uninstalling on a clean machine is a no-op, not an error.
  result = cli(['uninstall'], env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No ponytail hooks/);
});

test('installer --project writes <cwd>/.cursor/hooks.json', () => {
  const home = path.join(temp, 'proj', 'home');
  const project = path.join(temp, 'proj', 'repo');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  const env = { HOME: home, USERPROFILE: home };

  let result = cli(['install', '--project'], env, project);
  assert.equal(result.status, 0, result.stderr);
  const file = path.join(project, '.cursor', 'hooks.json');
  assert.ok(fs.existsSync(file));
  assert.equal(fs.existsSync(path.join(home, '.cursor', 'hooks.json')), false, '--project must not touch the user file');

  result = cli(['uninstall', '--project'], env, project);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(file), false);
});

test('installer refuses to touch a malformed hooks.json', () => {
  const home = path.join(temp, 'broken', 'home');
  fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });
  const file = path.join(home, '.cursor', 'hooks.json');
  const broken = '{ "version": 1, "hooks": { broken';
  fs.writeFileSync(file, broken);
  const env = { HOME: home, USERPROFILE: home };

  for (const action of ['install', 'uninstall']) {
    const result = cli([action], env);
    assert.notEqual(result.status, 0, `${action} must fail on malformed JSON`);
    assert.match(result.stderr, /not valid JSON/);
    assert.equal(fs.readFileSync(file, 'utf8'), broken, 'malformed file must be left byte-for-byte intact');
  }
});
