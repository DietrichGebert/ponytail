#!/usr/bin/env node
// Smoke test for the Copilot plugin adapter: keep command wiring minimal and
// ensure the debt command is part of the shared command surface.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const REQUIRED_COMMAND_FILES = [
  'ponytail.toml',
  'ponytail-review.toml',
  'ponytail-audit.toml',
  'ponytail-debt.toml',
  'ponytail-gain.toml',
  'ponytail-help.toml',
];

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('copilot plugin command directory includes ponytail-debt', () => {
  const manifest = readJSON('.github/plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.equal(manifest.commands, 'commands/');

  for (const file of REQUIRED_COMMAND_FILES) {
    assert.ok(
      fs.existsSync(path.join(root, manifest.commands, file)),
      `missing command file: ${manifest.commands}${file}`,
    );
  }
});

test('copilot hook commands use platform-native plugin root expansion', () => {
  const manifest = readJSON('hooks/copilot-hooks.json');
  const hooks = Object.values(manifest.hooks).flat();

  for (const hook of hooks) {
    assert.match(hook.bash, /"\$PLUGIN_ROOT\/hooks\//);
    assert.doesNotMatch(hook.bash, /\$\{PLUGIN_ROOT\}\//);
    assert.match(hook.powershell, /"\$\{PLUGIN_ROOT\}\\hooks\\/);
  }
});

test('copilot bash hooks resolve a plugin root containing spaces', (t) => {
  const manifest = readJSON('hooks/copilot-hooks.json');
  const hooks = Object.values(manifest.hooks).flat();

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail plugin '));
  const pluginRoot = path.join(temp, 'root with spaces');
  const home = path.join(temp, 'home');
  fs.cpSync(path.join(root, 'hooks'), path.join(pluginRoot, 'hooks'), { recursive: true });
  fs.mkdirSync(home);

  for (const hook of hooks) {
    const result = spawnSync('bash', ['-c', hook.bash], {
      env: {
        ...process.env,
        PLUGIN_ROOT: pluginRoot,
        HOME: home,
        USERPROFILE: home,
        PONYTAIL_DEFAULT_MODE: 'full',
      },
      input: '',
      encoding: 'utf8',
    });
    if (result.error?.code === 'ENOENT') {
      t.skip('bash is unavailable');
      return;
    }
    assert.equal(result.status, 0, result.stderr);
  }
});
