#!/usr/bin/env node
// Smoke test for the Cursor plugin adapter: manifest, hooks, rules, command and
// skills wiring, plus the Cursor-specific hook output shape (Cursor parses hook
// stdout as JSON and only sessionStart accepts injected context).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const SKILL_DIRS = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('cursor plugin manifest points at files that ship', () => {
  const manifest = readJSON('.cursor-plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.ok(manifest.version, 'manifest must declare a version');
  assert.ok(manifest.description, 'manifest must declare a description');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.rules, './.cursor/rules/');
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.commands, './.cursor/commands/');
  assert.equal(manifest.hooks, './hooks/cursor-hooks.json');

  for (const rel of [manifest.rules, manifest.skills, manifest.commands, manifest.hooks, manifest.logo]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `manifest points at missing path: ${rel}`);
  }
  for (const skill of SKILL_DIRS) {
    assert.ok(
      fs.existsSync(path.join(root, 'skills', skill, 'SKILL.md')),
      `missing skill: skills/${skill}/SKILL.md`,
    );
  }
});

test('cursor hooks use camelCase events and resolve via CURSOR_PLUGIN_ROOT', () => {
  const config = readJSON('hooks/cursor-hooks.json');
  assert.equal(config.version, 1);
  assert.match(config.hooks.sessionStart[0].command, /ponytail-activate\.js/);
  assert.match(config.hooks.beforeSubmitPrompt[0].command, /ponytail-mode-tracker\.js/);
  for (const event of Object.keys(config.hooks)) {
    assert.match(
      config.hooks[event][0].command,
      /\$\{CURSOR_PLUGIN_ROOT\}/,
      `${event} command must resolve through CURSOR_PLUGIN_ROOT`,
    );
  }
});

test('cursor rule and /ponytail command exist', () => {
  const rule = fs.readFileSync(path.join(root, '.cursor', 'rules', 'ponytail.mdc'), 'utf8');
  assert.match(rule, /alwaysApply:\s*true/, 'the rule must be always-on');
  assert.match(rule, /lazy senior developer/);
  const command = fs.readFileSync(path.join(root, '.cursor', 'commands', 'ponytail.md'), 'utf8');
  assert.match(command, /^---\n[\s\S]*description:/, 'command needs frontmatter with a description');
  assert.match(command, /lite, full, ultra, or off/);
});

test('cursor hook output: sessionStart injects, beforeSubmitPrompt only confirms', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-cursor-'));
  const state = path.join(temp, '.cursor', '.ponytail-active');
  const env = {
    ...process.env,
    HOME: temp,
    USERPROFILE: temp,
    CURSOR_PLUGIN_ROOT: root,
    PONYTAIL_DEFAULT_MODE: 'full',
  };
  delete env.PLUGIN_DATA;
  delete env.COPILOT_PLUGIN_DATA;
  delete env.QODER_SESSION_ID;

  const run = (script, input = '') => spawnSync(
    process.execPath,
    [path.join(root, 'hooks', script)],
    { env, input, encoding: 'utf8' },
  );

  let result = run('ponytail-activate.js');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(state, 'utf8'), 'full');
  let output = JSON.parse(result.stdout);
  assert.match(output.additional_context, /PONYTAIL MODE ACTIVE — level: full/);
  assert.ok(!/STATUSLINE SETUP NEEDED/.test(output.additional_context), 'Cursor has no statusline to nudge about');

  result = run('ponytail-mode-tracker.js', JSON.stringify({ prompt: '/ponytail ultra' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(state, 'utf8'), 'ultra', 'switch must persist to ~/.cursor');
  output = JSON.parse(result.stdout);
  assert.equal(output.continue, true, 'beforeSubmitPrompt must never block the prompt');
  assert.match(output.user_message, /PONYTAIL MODE CHANGED — level: ultra/);

  result = run('ponytail-mode-tracker.js', JSON.stringify({ prompt: 'stop ponytail' }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(state), false, 'flag must be cleared after stop ponytail');

  fs.rmSync(temp, { recursive: true, force: true });
});
