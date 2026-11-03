const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const manifest = require('../hooks/claude-codex-hooks.json');
const commands = Object.values(manifest.hooks).map((entries) => entries[0].hooks[0].command);

test('lifecycle hooks use either supplied plugin root and fail clearly without one', () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-root-test-'));
  for (const variable of ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT', null]) {
    for (const command of commands) {
      const env = { ...process.env, PLUGIN_DATA: state, CLAUDE_CONFIG_DIR: state, PONYTAIL_MAP: '0', PONYTAIL_DEFAULT_MODE: 'full' };
      delete env.CLAUDE_PLUGIN_ROOT;
      delete env.PLUGIN_ROOT;
      if (variable) env[variable] = root;
      const result = spawnSync(command, { shell: true, env, input: '{}', encoding: 'utf8' });
      if (variable) assert.equal(result.status, 0, result.stderr);
      else {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Plugin root is missing/);
      }
    }
  }
});

test('plugin root precedence and paths stay inside the node process', () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-root-path-'));
  const specialRoot = path.join(state, 'plugin space & semicolon;');
  fs.cpSync(path.join(root, 'hooks'), path.join(specialRoot, 'hooks'), { recursive: true });
  const env = { ...process.env, PLUGIN_DATA: state, CLAUDE_CONFIG_DIR: state, PONYTAIL_MAP: '0', PONYTAIL_DEFAULT_MODE: 'full' };
  for (const command of commands) {
    for (const variable of ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_ROOT']) {
      const selected = { ...env };
      delete selected.CLAUDE_PLUGIN_ROOT;
      delete selected.PLUGIN_ROOT;
      selected[variable] = specialRoot;
      const result = spawnSync(command, { shell: true, env: selected, input: '{}', encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const both = { ...env, CLAUDE_PLUGIN_ROOT: specialRoot, PLUGIN_ROOT: path.join(state, 'missing') };
    assert.equal(spawnSync(command, { shell: true, env: both, input: '{}', encoding: 'utf8' }).status, 0);
    both.CLAUDE_PLUGIN_ROOT = path.join(state, 'missing');
    both.PLUGIN_ROOT = specialRoot;
    assert.notEqual(spawnSync(command, { shell: true, env: both, input: '{}', encoding: 'utf8' }).status, 0);
  }
});

test('PLUGIN_ROOT does not by itself identify the host as Codex', () => {
  const env = { ...process.env, PLUGIN_ROOT: root };
  for (const name of ['CLAUDE_PLUGIN_ROOT', 'PLUGIN_DATA', 'COPILOT_PLUGIN_DATA', 'QODER_SESSION_ID', 'CODEBUDDY_PLUGIN_ROOT', 'CURSOR_VERSION']) delete env[name];
  const script = "process.stdout.write(String(require('./hooks/ponytail-runtime').isCodex))";
  const withoutData = spawnSync(process.execPath, ['-e', script], { cwd: root, env, encoding: 'utf8' });
  assert.equal(withoutData.status, 0, withoutData.stderr);
  assert.equal(withoutData.stdout, 'false');
  env.PLUGIN_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-host-test-'));
  const withData = spawnSync(process.execPath, ['-e', script], { cwd: root, env, encoding: 'utf8' });
  assert.equal(withData.status, 0, withData.stderr);
  assert.equal(withData.stdout, 'true');
});
