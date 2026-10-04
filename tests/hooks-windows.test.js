#!/usr/bin/env node
// Regression test for issues #19 and #593: on Windows the lifecycle hooks run
// via PowerShell, so the shared `command` field must be cross-platform (plain
// `node`, no bash-only syntax). commandWindows is not part of the supported
// hooks schema on the Claude.ai plugin marketplace validator, so it is omitted
// — plain `node -e "..."` works everywhere without relying on shell-specific
// variable syntax (see #824: the command text used to embed a
// ${CLAUDE_PLUGIN_ROOT} placeholder that the *host* substitutes textually
// before the shell parses the command, which is unsafe if the substituted
// value carries shell metacharacters — the fixed command instead reads
// process.env.CLAUDE_PLUGIN_ROOT from inside Node, so the shell never
// re-parses the plugin root at all).
//
// The hook also has to point at a script that actually ships in hooks/.
//
// Issue #791: Claude Code on Windows dispatches shell-form hook `command`s
// through a shell (Git Bash/PowerShell), which allocates a visible conhost
// window on every hook firing. Claude's hook schema supports an `args` array
// (exec form), so Claude gets its own hooks/claude-hooks.json with a bare
// `node` command plus args — Windows then spawns node directly with no shell
// and no flash. Codex keeps the shared shell-form hooks/claude-codex-hooks.json
// because its hook schema has no `args` field.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const HOOKS_JSON = 'hooks/claude-codex-hooks.json';
const CLAUDE_HOOKS_JSON = 'hooks/claude-hooks.json';
const COPILOT_HOOKS_JSON = 'hooks/copilot-hooks.json';
// PowerShell 5.1 rejects these POSIX shell guards when a host runs `command`.
const POSIX_GUARD_SYNTAX = /\bcommand\s+-v\b|&&|\|\||>\/dev\/null|2>&1/;
// Pull the hooks/<script> a command launches, so we can check it exists.
const HOOK_SCRIPT = /hooks[\\/]([\w.-]+\.(?:js|mjs|cjs|ps1|sh))/;
// #824: a plugin-root placeholder textually interpolated into shell command
// text is unsafe — the host substitutes it before the shell parses the
// command, so a hostile install path can break out of the quoting.
const PLUGIN_ROOT_PLACEHOLDER = /\$\{(?:CLAUDE_)?PLUGIN_ROOT\}/;

// Read inside each case so a missing/malformed file fails as a clean assertion,
// not a load-time crash.
function commandHooks() {
  const config = JSON.parse(fs.readFileSync(path.join(root, HOOKS_JSON), 'utf8'));
  return Object.values(config.hooks)
    .flat()
    .flatMap((entry) => entry.hooks);
}

function copilotCommands() {
  const config = JSON.parse(fs.readFileSync(path.join(root, COPILOT_HOOKS_JSON), 'utf8'));
  return Object.values(config.hooks)
    .flat()
    .flatMap((entry) => [entry.bash, entry.powershell]);
}

// commandWindows is not part of the supported hooks schema on the Claude.ai
// plugin marketplace validator (#593). Since the shared `command` field
// already runs cross-platform (plain `node -e "..."`, no shell-specific
// syntax, and VS Code Copilot ignores commandWindows and runs `command`
// through PowerShell on Windows anyway), it is omitted.
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

test('Claude and Codex manifests point at a hooks config that ships (#791)', () => {
  // Claude uses the exec-form config (no shell, no conhost flash on Windows);
  // Codex keeps the shared shell-form config (its hook schema has no `args`).
  const expected = {
    '.claude-plugin/plugin.json': './hooks/claude-hooks.json',
    '.codex-plugin/plugin.json': './hooks/claude-codex-hooks.json',
  };
  for (const [rel, hooks] of Object.entries(expected)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.equal(manifest.hooks, hooks, `${rel} must not rely on root hooks auto-discovery`);
    assert.ok(
      fs.existsSync(path.join(root, hooks.replace(/^\.\//, ''))),
      `${rel} points at a hooks config that must ship: ${hooks}`,
    );
  }
});

// Read inside each case so a missing/malformed file fails as a clean assertion,
// not a load-time crash.
function claudeCommandHooks() {
  const config = JSON.parse(fs.readFileSync(path.join(root, CLAUDE_HOOKS_JSON), 'utf8'));
  return Object.values(config.hooks)
    .flat()
    .flatMap((entry) => entry.hooks);
}

// Issue #791: exec-form hooks must carry the script in `args` with a bare
// executable in `command` — no shell string. That is what lets Windows spawn
// node directly (no conhost flash). A `command` containing whitespace would
// silently fall back to shell-form dispatch and reintroduce the flash.
test('claude-hooks.json uses exec form so Windows spawns node with no shell (#791)', () => {
  const hooks = claudeCommandHooks();
  assert.ok(hooks.length > 0, 'expected at least one Claude hook entry');
  for (const hook of hooks) {
    assert.doesNotMatch(hook.command, /\s/, `exec-form command must be a bare executable, not a shell string: ${hook.command}`);
    assert.ok(Array.isArray(hook.args) && hook.args.length > 0, `exec-form hook must carry args: ${hook.command}`);
  }
});

test('claude-hooks.json covers the same hook events as the shared config (#791)', () => {
  const shared = JSON.parse(fs.readFileSync(path.join(root, HOOKS_JSON), 'utf8'));
  const claude = JSON.parse(fs.readFileSync(path.join(root, CLAUDE_HOOKS_JSON), 'utf8'));
  assert.deepEqual(
    Object.keys(claude.hooks).sort(),
    Object.keys(shared.hooks).sort(),
    'Claude exec-form config must cover the same hook events as the shared config',
  );
});

test('claude-hooks.json args point at scripts that ship in hooks/ (#791)', () => {
  for (const hook of claudeCommandHooks()) {
    for (const arg of hook.args) {
      const match = arg.match(HOOK_SCRIPT);
      assert.ok(match, `cannot find a hooks/ script in arg: ${arg}`);
      const script = path.join(root, 'hooks', match[1]);
      assert.ok(fs.existsSync(script), `args reference a missing hook script: ${match[1]}`);
    }
  }
});

// #824, exec-form edition: the ${CLAUDE_PLUGIN_ROOT} placeholder is substituted
// by the host into an argv element, never parsed by a shell, so a hostile
// install path cannot break out into shell text the way it could inside a
// shell-form `command` string. Assert the args carry no shell syntax at all —
// belt and braces on top of the argv immunity.
test('claude-hooks.json args carry no shell syntax (#791, #824)', () => {
  for (const hook of claudeCommandHooks()) {
    for (const arg of hook.args) {
      assert.doesNotMatch(arg, /;|`|\$\(|&&|\|\|/, `exec-form arg must not contain shell syntax: ${arg}`);
    }
  }
});

// #824: lifecycle hook commands must not interpolate the plugin-root
// placeholder into shell text — a host that substitutes it textually before
// the shell parses the command lets a hostile install path break out of the
// quoting. Commands must instead have the invoked script read the root from
// its own process.env.
test('claude-codex-hooks.json commands contain no plugin-root placeholder', () => {
  const commands = commandHooks().map((h) => h.command).filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one shared command entry');
  for (const cmd of commands) {
    assert.doesNotMatch(cmd, PLUGIN_ROOT_PLACEHOLDER, `command interpolates the plugin root into shell text: ${cmd}`);
  }
});

test('copilot-hooks.json commands contain no plugin-root placeholder', () => {
  const commands = copilotCommands().filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one copilot command entry');
  for (const cmd of commands) {
    assert.doesNotMatch(cmd, PLUGIN_ROOT_PLACEHOLDER, `command interpolates the plugin root into shell text: ${cmd}`);
  }
});

// End-to-end proof for #824. The reported mechanism is specifically a HOST
// that textually substitutes a ${CLAUDE_PLUGIN_ROOT}/${PLUGIN_ROOT}
// placeholder into the command STRING itself before a shell parses it — a
// real shell's own quoted ${VAR} expansion is safe (no re-parsing inside
// double quotes), so invoking the raw command with the env var merely SET
// does not reproduce the bug. This test instead performs that host-style
// substitution explicitly, matching the threat model in the issue: before
// the fix this created MARKER; after the fix there is no placeholder left to
// substitute, so the hostile value never reaches shell text at all.
test('a hostile plugin root cannot inject shell commands via host-side textual substitution (#824)', () => {
  const isWindows = process.platform === 'win32';
  const commands = [...commandHooks().map((h) => h.command), ...copilotCommands()].filter(Boolean);
  assert.ok(commands.length > 0, 'expected at least one command to check');

  const marker = path.join(os.tmpdir(), `ponytail-824-marker-${process.pid}`);
  const hostileRoot = isWindows
    ? `C:\\x" ; New-Item -ItemType File -Path "${marker}" ; "`
    : `/tmp/x"; touch "${marker}"; echo "`;

  for (const cmd of commands) {
    fs.rmSync(marker, { force: true });
    const substituted = cmd
      .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, hostileRoot)
      .replace(/\$\{PLUGIN_ROOT\}/g, hostileRoot);
    try {
      if (isWindows) {
        execFileSync('powershell', ['-NoProfile', '-Command', substituted], { stdio: 'ignore' });
      } else {
        execFileSync('bash', ['-c', substituted], { stdio: 'ignore' });
      }
    } catch (e) {
      // Expected to fail (resolves to a bogus module path) — only whether
      // MARKER was created matters.
    }
    assert.equal(fs.existsSync(marker), false, `hostile plugin root injected shell commands via: ${cmd}`);
  }
  fs.rmSync(marker, { force: true });
});
