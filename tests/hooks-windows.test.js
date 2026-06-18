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
const HOOKS_JSON = 'hooks/hooks.json';
const COPILOT_HOOKS_JSON = 'hooks/copilot-hooks.json';
// cmd.exe variable syntax (%FOO%); PowerShell leaves it literal, breaking the path.
const CMD_VAR_SYNTAX = /%[A-Za-z_][A-Za-z0-9_]*%/;
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

// Claude's hooks.json carries command/commandWindows; Copilot's copilot-hooks.json
// uses a flatter shape with bash/powershell. Return every raw command string a
// manifest launches, so existence and parity checks can share one extractor.
function claudeCommands() {
  return commandHooks().flatMap((h) => [h.command, h.commandWindows].filter(Boolean));
}

function copilotCommands() {
  const config = JSON.parse(fs.readFileSync(path.join(root, COPILOT_HOOKS_JSON), 'utf8'));
  return Object.values(config.hooks)
    .flat()
    .flatMap((entry) => [entry.bash, entry.powershell].filter(Boolean));
}

// The set of hooks/<script> basenames a list of command strings references.
function scriptSet(commands) {
  return new Set(commands.flatMap((cmd) => {
    const m = cmd.match(HOOK_SCRIPT);
    return m ? [m[1]] : [];
  }));
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

test('every hook command points at a script that ships in hooks/', () => {
  for (const cmd of [...claudeCommands(), ...copilotCommands()]) {
    const match = cmd.match(HOOK_SCRIPT);
    assert.ok(match, `cannot find a hooks/ script in command: ${cmd}`);
    const script = path.join(root, 'hooks', match[1]);
    assert.ok(fs.existsSync(script), `command references a missing hook script: ${match[1]}`);
  }
});

// A new lifecycle hook added to one host manifest but forgotten in the other
// would silently leave that host un-wired — Claude's gate would never catch it.
test('hooks.json and copilot-hooks.json wire the same hooks/ scripts', () => {
  const claude = [...scriptSet(claudeCommands())].sort();
  const copilot = [...scriptSet(copilotCommands())].sort();
  assert.ok(claude.length > 0, 'expected at least one claude hook script');
  assert.deepEqual(copilot, claude, 'a hook script is wired in one host manifest but not the other');
});
