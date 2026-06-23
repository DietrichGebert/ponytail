#!/usr/bin/env node
// Regression test for issue #19: on Windows the lifecycle hooks run via
// PowerShell, which does NOT expand cmd.exe-style %VAR% — it needs $env:VAR.
// The hook also has to point at a script that actually ships in hooks/.
// This guards both failure modes: the original %CLAUDE_PLUGIN_ROOT% bug, and
// the "switch to a .ps1 that doesn't exist" mistake.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const HOOKS_JSON = 'hooks/claude-codex-hooks.json';
const HOST_PLUGIN_MANIFESTS = [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
];
// cmd.exe variable syntax (%FOO%); PowerShell leaves it literal, breaking the path.
const CMD_VAR_SYNTAX = /%[A-Za-z_][A-Za-z0-9_]*%/;
// PowerShell 5.1 rejects these POSIX shell guards when a host runs `command`.
const POSIX_GUARD_SYNTAX = /\bcommand\s+-v\b|&&|\|\||>\/dev\/null|2>&1/;
// Pull the hooks/<script> a command launches, so we can check it exists.
const HOOK_SCRIPT = /hooks[\\/]([\w.-]+\.(?:js|mjs|cjs|ps1|sh))/;

// Read inside each case so a missing/malformed file fails as a clean assertion,
// not a load-time crash.
function commandHooks() {
  const config = JSON.parse(fs.readFileSync(path.join(root, HOOKS_JSON), 'utf8'));
  return Object.values(config.hooks)
    .flat()
    .flatMap((entry) => entry.hooks);
}

test('every commandWindows uses PowerShell $env: syntax, not cmd.exe %VAR%', () => {
  const windowsCommands = commandHooks()
    .map((h) => h.commandWindows)
    .filter(Boolean);
  assert.ok(windowsCommands.length > 0, 'expected at least one commandWindows entry');
  for (const cmd of windowsCommands) {
    assert.doesNotMatch(cmd, CMD_VAR_SYNTAX, `commandWindows uses cmd.exe %VAR% (breaks under PowerShell): ${cmd}`);
  }
});

test('shared hook commands avoid POSIX-only guard syntax', () => {
  const commands = commandHooks()
    .map((h) => h.command)
    .filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one shared command entry');
  for (const cmd of commands) {
    assert.doesNotMatch(cmd, POSIX_GUARD_SYNTAX, `command uses POSIX-only guard syntax: ${cmd}`);
  }
});

test('shared hook commands keep lifecycle hooks non-blocking', () => {
  const commands = commandHooks()
    .map((h) => h.command)
    .filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one shared command entry');
  for (const cmd of commands) {
    assert.match(cmd, /;\s*exit 0$/, `command must exit successfully if node or the hook script fails: ${cmd}`);
  }
});

test('every hook command points at a script that ships in hooks/', () => {
  for (const hook of commandHooks()) {
    for (const cmd of [hook.command, hook.commandWindows].filter(Boolean)) {
      const match = cmd.match(HOOK_SCRIPT);
      assert.ok(match, `cannot find a hooks/ script in command: ${cmd}`);
      const script = path.join(root, 'hooks', match[1]);
      assert.ok(fs.existsSync(script), `command references a missing hook script: ${match[1]}`);
    }
  }
});

test('Claude and Codex manifests point at the shared host-specific hook config', () => {
  for (const rel of HOST_PLUGIN_MANIFESTS) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.equal(manifest.hooks, `./${HOOKS_JSON}`, `${rel} must not rely on root hooks auto-discovery`);
  }
});
