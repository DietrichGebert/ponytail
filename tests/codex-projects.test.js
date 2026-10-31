const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-codex-projects-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(CLAUDE_|COPILOT_|CODEBUDDY_|CURSOR_|QODER_|PLUGIN_|PONYTAIL_)/.test(key)) delete env[key];
  }
  Object.assign(env, {
    HOME: dir, USERPROFILE: dir, XDG_CONFIG_HOME: path.join(dir, 'config'),
    PLUGIN_DATA: path.join(dir, 'data'), PONYTAIL_DEFAULT_MODE: 'full', PONYTAIL_MAP: '0',
  }, overrides);
  const a = path.join(dir, 'repo-a');
  const b = path.join(dir, 'repo-b');
  function run(script, data = {}, extraEnv = {}) {
    const r = spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
      env: { ...env, ...extraEnv }, cwd: dir,
      input: typeof data === 'string' ? data : JSON.stringify(data),
      encoding: 'utf8', timeout: 4000,
    });
    assert.equal(r.status, 0, `${script}: ${r.error || r.stderr}`);
    assert.equal(r.stderr, '');
    return r.stdout;
  }
  const start = (cwd, source = 'startup', extraEnv) => run('ponytail-activate.js', { cwd, source }, extraEnv);
  const prompt = (cwd, prompt) => run('ponytail-mode-tracker.js', { cwd, prompt });
  const subagent = (cwd, extraEnv) => run('ponytail-subagent.js', { cwd, agent_type: 'explore' }, extraEnv);
  return { a, b, dir, env, run, start, prompt, subagent };
}

test('Codex startup, prompts, subagents and compaction keep separate project modes', t => {
  const f = fixture(t);
  f.start(f.a);
  f.prompt(f.a, '/ponytail lite');
  f.start(f.b);
  assert.match(f.prompt(f.a, '/ponytail'), /level: lite/, 'B startup must not reset A');
  assert.match(f.subagent(f.a), /level: lite/, 'A subagent must inherit A');
  assert.match(f.subagent(f.b), /level: full/, 'B subagent must inherit B');
  f.prompt(f.b, '/ponytail ultra');
  assert.match(f.start(f.a, 'compact'), /level: lite/, 'A compaction must keep A');
  assert.match(f.subagent(f.b), /level: ultra/, 'A compaction must not rewrite B');
  f.prompt(f.b, '/ponytail off');
  assert.equal(f.subagent(f.b), '');
  assert.equal(f.start(f.b, 'compact'), '');
  assert.match(f.subagent(f.a), /level: lite/, 'B off must not clear A');
  f.start(f.b, 'startup', { PONYTAIL_DEFAULT_MODE: 'off' });
  assert.match(f.subagent(f.a), /level: lite/, 'B off startup must not clear A');
});

test('Codex scoped subagents preserve matcher behavior and accept a BOM payload', t => {
  const f = fixture(t);
  f.start(f.a);
  f.prompt(f.a, '/ponytail lite');
  f.start(f.b);
  assert.match(f.subagent(f.a, { PONYTAIL_SUBAGENT_MATCHER: '^explore$' }), /level: lite/);
  assert.equal(f.subagent(f.a, { PONYTAIL_SUBAGENT_MATCHER: '^review$' }), '');
  assert.match(f.subagent(f.a, { PONYTAIL_SUBAGENT_MATCHER: '[' }), /level: lite/);
  assert.match(f.run('ponytail-activate.js', '\uFEFF' + JSON.stringify({ cwd: f.a, source: 'compact' })), /level: lite/);
});

test('environment project takes precedence and other hosts ignore payload cwd', t => {
  for (const overrides of [{ CLAUDE_PROJECT_DIR: '/environment-project' }, { PLUGIN_DATA: '' }]) {
    const f = fixture(t, overrides);
    f.start(f.a);
    f.prompt(f.a, '/ponytail lite');
    assert.match(f.subagent(f.b), /level: lite/);
    f.prompt(f.b, '/ponytail ultra');
    assert.match(f.subagent(f.a), /level: ultra/);
  }
});

test('Codex without a usable cwd keeps legacy shared state', t => {
  const f = fixture(t);
  for (const cwd of [undefined, null, '', '   ', 42, {}, []]) {
    f.start(cwd);
    f.prompt(cwd, '/ponytail lite');
    assert.match(f.subagent(cwd), /level: lite/);
    assert.match(f.start(cwd, 'compact'), /level: lite/);
  }
  for (const input of ['', '{invalid', 'null']) {
    assert.match(f.run('ponytail-activate.js', input), /level: full/);
    assert.match(f.run('ponytail-subagent.js', input), /level: full/);
  }
});

test('Codex subagent recovers project context without EOF and never waits indefinitely', async t => {
  const f = fixture(t);
  f.start(f.a);
  f.prompt(f.a, '/ponytail lite');
  f.start(f.b);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'hooks', 'ponytail-subagent.js')], {
      env: f.env, cwd: f.dir, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    const watchdog = setTimeout(() => { child.kill(); reject(new Error('hook hung with open stdin')); }, 3500);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => { clearTimeout(watchdog); resolve({ code, stdout, stderr }); });
    child.stdin.on('error', () => {});
    child.stdin.write(JSON.stringify({ cwd: f.a }));
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /level: lite/);
});

for (const [script, mode] of [
  ['ponytail-activate.js', 'full'],
  ['ponytail-mode-tracker.js', 'ultra'],
  ['ponytail-subagent.js', 'lite'],
]) {
  test(`Codex ${script} preserves a cwd character split across stdin chunks`, async t => {
    const f = fixture(t);
    const character = '\u{1f680}';
    const cwd = path.join(f.dir, 'project-' + character);
    f.start(cwd);
    f.prompt(cwd, '/ponytail lite');
    f.start(f.b);
    const input = Buffer.from(JSON.stringify({ cwd, source: 'startup', prompt: '/ponytail ultra' }));
    const split = input.indexOf(Buffer.from(character)) + 1;
    const result = await new Promise((resolve, reject) => {
      // Acknowledge the first data event so pipe buffering cannot merge the writes.
      const driver = 'require(process.argv[1]); process.stdin.once("data", () => process.send("chunk")); process.send("ready");';
      const child = spawn(process.execPath, ['-e', driver, path.join(root, 'hooks', script)], {
        env: f.env, cwd: f.dir, stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
      let stdout = '', stderr = '';
      const watchdog = setTimeout(() => { child.kill(); reject(new Error('hook hung with split input')); }, 3500);
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(watchdog); reject(error); });
      child.on('close', code => { clearTimeout(watchdog); resolve({ code, stdout, stderr }); });
      child.stdin.on('error', () => {});
      child.on('message', message => {
        if (message === 'ready') child.stdin.write(input.subarray(0, split));
        if (message === 'chunk') child.stdin.end(input.subarray(split));
      });
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, new RegExp('level: ' + mode));
    assert.match(f.subagent(cwd), new RegExp('level: ' + mode));
  });
}
