#!/usr/bin/env node
// Regression test for issues #19 and #593: on Windows the lifecycle hooks run
// via PowerShell, so the shared `command` field must be cross-platform (plain
// `node`, no bash-only syntax). commandWindows is not part of the supported
// hooks schema on the Claude.ai plugin marketplace validator, so it is omitted
// — ${CLAUDE_PLUGIN_ROOT} expansion and `node` work everywhere.
//
// The hook also has to point at a script that actually ships in hooks/.

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

// commandWindows is not part of the supported hooks schema on the Claude.ai
// plugin marketplace validator (#593). Since the shared `command` field
// already runs cross-platform (Claude Code expands ${CLAUDE_PLUGIN_ROOT}
// before the shell sees it, and VS Code Copilot ignores commandWindows and
// runs `command` through PowerShell on Windows anyway), it is omitted.
test('hooks.json omits commandWindows for marketplace validation (#593)', () => {
  for (const hook of commandHooks()) {
    assert.equal(hook.commandWindows, undefined, `hook must not use commandWindows (not supported by marketplace validator): ${hook.command}`);
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
    const cmd = hook.command;
    const match = cmd.match(HOOK_SCRIPT);
    assert.ok(match, `cannot find a hooks/ script in command: ${cmd}`);
    const script = path.join(root, 'hooks', match[1]);
    assert.ok(fs.existsSync(script), `command references a missing hook script: ${match[1]}`);
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
