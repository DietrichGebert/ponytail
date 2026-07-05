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
const { spawn } = require('child_process');

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

test('shared hook commands exec node instead of leaving a wrapper shell behind', () => {
  const commands = commandHooks()
    .map((h) => h.command)
    .filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one shared command entry');
  for (const cmd of commands) {
    assert.match(cmd, /^exec node\s+/, `command must replace the shell with node: ${cmd}`);
    assert.doesNotMatch(cmd, /;\s*exit 0$/, `command must not leave a shell wrapper waiting on node: ${cmd}`);
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

// Issue #443: on Windows the UserPromptSubmit hook runs inside a PowerShell
// `if {}` wrapper that can swallow the piped prompt JSON, so stdin 'end' never
// fires. The hook must never wait on stdin forever — that freezes the whole
// session. It has to self-exit even when stdin stays open and empty.
test('ponytail-mode-tracker self-exits when stdin never closes (no freeze)', async () => {
  const hook = path.join(root, 'hooks', 'ponytail-mode-tracker.js');
  // stdin is a pipe we never write to or end, reproducing the deadlock.
  const child = spawn(process.execPath, [hook], { stdio: ['pipe', 'ignore', 'ignore'] });

  const code = await new Promise((resolve, reject) => {
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('hook hung on open stdin — it would freeze the session'));
    }, 3000);
    child.on('exit', (c) => { clearTimeout(guard); resolve(c); });
    child.on('error', reject);
  });

  assert.equal(code, 0, 'hook must exit cleanly when stdin never closes');
});

test('Claude and Codex manifests point at the shared host-specific hook config', () => {
  for (const rel of HOST_PLUGIN_MANIFESTS) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.equal(manifest.hooks, `./${HOOKS_JSON}`, `${rel} must not rely on root hooks auto-discovery`);
  }
});
