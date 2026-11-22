#!/usr/bin/env node
// Smoke test for the Copilot plugin adapter: keep command wiring minimal and
// ensure the debt command is part of the shared command surface.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

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

test('copilot hooks manifest registers sessionStart and userPromptSubmitted', () => {
  const manifest = readJSON('.github/plugin/plugin.json');
  assert.equal(manifest.hooks, 'hooks/copilot-hooks.json');
  const hooksConfig = readJSON(manifest.hooks);
  assert.equal(hooksConfig.version, 1);
  assert.ok(Array.isArray(hooksConfig.hooks.sessionStart), 'expected sessionStart hook array');
  assert.ok(Array.isArray(hooksConfig.hooks.userPromptSubmitted), 'expected userPromptSubmitted hook array');
});

test('copilot runtime emits additionalContext on SessionStart and suppresses non-SessionStart output', () => {
  const { spawnSync } = require('child_process');
  const res = spawnSync(process.execPath, ['-e', `
    const fs = require('fs');
    const { writeHookOutput } = require('./hooks/ponytail-runtime');
    let out = '';
    const orig = fs.writeSync;
    fs.writeSync = (fd, data) => { if (fd === 1) out += data; return data.length; };
    writeHookOutput('SessionStart', 'full', 'PONYTAIL RULES');
    const startObj = JSON.parse(out);
    out = '';
    writeHookOutput('UserPromptSubmit', 'lite', 'MODE SWITCH');
    const promptObj = JSON.parse(out);
    console.log(JSON.stringify({ startObj, promptObj }));
  `], {
    cwd: root,
    env: { ...process.env, COPILOT_PLUGIN_DATA: '/tmp/copilot-test' },
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(res.stdout.trim());
  assert.deepEqual(data.startObj, { additionalContext: 'PONYTAIL RULES' });
  assert.deepEqual(data.promptObj, {});
});

