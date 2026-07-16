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
const HOST_PLUGIN_MANIFEST_HOOKS = {
  // Issue #582: the Claude marketplace validator rejects non-standard hook
  // fields (commandWindows), so Claude gets a schema-clean copy of the config.
  '.claude-plugin/plugin.json': 'hooks/claude-hooks.json',
  '.codex-plugin/plugin.json': HOOKS_JSON,
};
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

// Issue #527 / #569: the shared `command` field must be shell-agnostic. `exec`
// is a bash/zsh builtin with no PowerShell equivalent, but some hosts run
// `command` through PowerShell on Windows regardless of the commandWindows
// field — VS Code Copilot always does (it never reads commandWindows), and
// native Claude Code launched from Git Bash was seen doing the same. `exec
// node ...` then dies on its first token with CommandNotFoundException, so
// every hook fails on Windows. Plain `node ...` runs natively in both bash and
// PowerShell. The wrapper-process pileup that #461 originally used `exec` to
// avoid is handled separately by each hook's stdin self-exit guard (#443/#477).
test('shared hook commands are shell-agnostic (no bash-only exec prefix)', () => {
  const commands = commandHooks()
    .map((h) => h.command)
    .filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one shared command entry');
  for (const cmd of commands) {
    assert.doesNotMatch(cmd, /(^|\s)exec\s/, `command must not use the bash-only 'exec' builtin (breaks under PowerShell): ${cmd}`);
    assert.match(cmd, /^node\s+/, `command must invoke node directly so it runs in both bash and PowerShell: ${cmd}`);
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

test('host manifests point at their host-specific hook config', () => {
  for (const [rel, hooksFile] of Object.entries(HOST_PLUGIN_MANIFEST_HOOKS)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.equal(manifest.hooks, `./${hooksFile}`, `${rel} must not rely on root hooks auto-discovery`);
  }
});

// Issue #582: Claude Desktop (Cowork) marketplace sync validates hook configs
// server-side and rejects any field it does not know. commandWindows is a
// Codex-only extension, so the Claude config must never carry it — otherwise
// the whole marketplace fails to sync with status failed_content.
test('Claude hook config only uses fields the marketplace schema accepts', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'claude-hooks.json'), 'utf8'));
  const hooks = Object.values(config.hooks).flat().flatMap((entry) => entry.hooks);
  assert.ok(hooks.length > 0, 'expected at least one Claude hook entry');
  for (const hook of hooks) {
    assert.equal(hook.commandWindows, undefined, 'commandWindows is rejected by the Claude marketplace validator (issue #582)');
  }
});

// The Claude config is a schema-clean mirror of the shared one: same events,
// same commands. Guards against the two files drifting apart.
test('Claude hook config stays in sync with the shared config', () => {
  const shared = JSON.parse(fs.readFileSync(path.join(root, HOOKS_JSON), 'utf8'));
  const claude = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'claude-hooks.json'), 'utf8'));
  const strip = (config) => Object.fromEntries(
    Object.entries(config.hooks).map(([event, entries]) => [event, entries.map((entry) => ({
      ...entry,
      hooks: entry.hooks.map(({ commandWindows, ...rest }) => rest),
    }))]),
  );
  assert.deepEqual(strip(claude), strip(shared), 'hooks/claude-hooks.json must mirror the shared config (minus commandWindows)');
});
