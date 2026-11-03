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
