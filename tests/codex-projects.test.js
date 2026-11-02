const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-codex-projects-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const projects = ['A', 'B'].map(name => path.join(temp, name));
  projects.forEach(dir => fs.mkdirSync(dir));
  const env = { ...process.env,
    PLUGIN_DATA: path.join(temp, 'plugin-data'),
    CLAUDE_CONFIG_DIR: path.join(temp, 'claude'),
    CLAUDE_PLUGIN_ROOT: root,
    XDG_CONFIG_HOME: path.join(temp, 'config'),
    PONYTAIL_DEFAULT_MODE: 'full',
    PONYTAIL_MAP: '0',
  };
  for (const key of ['CLAUDE_PROJECT_DIR', 'COPILOT_PLUGIN_DATA', 'QODER_SESSION_ID',
    'CODEBUDDY_PLUGIN_ROOT', 'CURSOR_VERSION', 'PONYTAIL_SUBAGENT_MATCHER']) delete env[key];
  function run(script, cwd, payload = {}, overrides = {}) {
    const result = spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
      cwd, env: { ...env, ...overrides },
      input: JSON.stringify({ cwd, ...payload }), encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  function level(script, cwd, payload) {
    const stdout = run(script, cwd, payload);
    return stdout ? JSON.parse(stdout).hookSpecificOutput?.additionalContext?.split('\n')[0] : '';
  }
  return { projects, env, run, level };
}

test('Codex projects keep their own mode without CLAUDE_PROJECT_DIR', t => {
  const { projects: [a, b], level, run } = fixture(t);
  run('ponytail-activate.js', a, { source: 'startup' });
  run('ponytail-mode-tracker.js', a, { prompt: '$ponytail:ponytail ultra' });
  run('ponytail-activate.js', b, { source: 'startup' });
  assert.equal(level('ponytail-subagent.js', a), 'PONYTAIL MODE ACTIVE — level: ultra');
  assert.equal(level('ponytail-activate.js', a, { source: 'compact' }), 'PONYTAIL MODE ACTIVE — level: ultra');
  assert.equal(level('ponytail-subagent.js', b), 'PONYTAIL MODE ACTIVE — level: full');

  run('ponytail-mode-tracker.js', b, { prompt: '$ponytail:ponytail off' });
  assert.equal(level('ponytail-subagent.js', b), '');
  assert.equal(level('ponytail-subagent.js', a), 'PONYTAIL MODE ACTIVE — level: ultra');
  run('ponytail-activate.js', b, { source: 'startup' }, { PONYTAIL_DEFAULT_MODE: 'off' });
  assert.equal(level('ponytail-activate.js', a, { source: 'compact' }), 'PONYTAIL MODE ACTIVE — level: ultra');
});

test('explicit project environment still takes precedence for Codex', t => {
  const { projects: [a, b], level, run } = fixture(t);
  run('ponytail-mode-tracker.js', b, { prompt: '$ponytail:ponytail lite' }, { CLAUDE_PROJECT_DIR: a });
  assert.equal(level('ponytail-subagent.js', a), 'PONYTAIL MODE ACTIVE — level: lite');
  assert.equal(level('ponytail-subagent.js', b), '');
});

test('project-less legacy hosts keep the existing shared flag', t => {
  const { projects: [a, b], env, run } = fixture(t);
  run('ponytail-mode-tracker.js', a, { prompt: '/ponytail ultra' }, { PLUGIN_DATA: '' });
  run('ponytail-mode-tracker.js', b, { prompt: '/ponytail lite' }, { PLUGIN_DATA: '' });
  assert.equal(fs.readFileSync(path.join(env.CLAUDE_CONFIG_DIR, '.ponytail-active'), 'utf8'), 'lite');
  assert.equal(fs.existsSync(path.join(env.CLAUDE_CONFIG_DIR, 'ponytail-modes')), false);
});
