#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

// isShellSafe gates the statusline setup snippet (issue #200): ordinary install
// paths pass, paths carrying shell metacharacters are rejected so they never get
// embedded in a shell command.
const { DEFAULT_MODE, getDefaultMode, isShellSafe, writeDefaultMode } = require('../hooks/ponytail-config');
assert.equal(isShellSafe('C:\\Users\\x\\.claude\\plugins\\ponytail\\hooks\\ponytail-statusline.ps1'), true);
assert.equal(isShellSafe('/home/u/.claude/plugins/ponytail/hooks/ponytail-statusline.sh'), true);
assert.equal(isShellSafe('/tmp/a"&calc.exe&"/x.sh'), false);
assert.equal(isShellSafe('/tmp/$(calc)/x.sh'), false);
assert.equal(isShellSafe('/tmp/a;rm -rf/x.sh'), false);

function run(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
  });
}

// Keep the base env clean so the default-dir / native-Claude checks are
// deterministic; the CLAUDE_CONFIG_DIR and codex/copilot cases set these
// explicitly where needed. run() spreads process.env, so a PLUGIN_DATA /
// COPILOT_PLUGIN_DATA leaked from the dev or CI shell would otherwise steer
// writeHookOutput into the wrong branch and mis-fire the native assertions.
delete process.env.CLAUDE_CONFIG_DIR;
delete process.env.PLUGIN_DATA;
delete process.env.COPILOT_PLUGIN_DATA;
// A leaked subagent matcher would scope the inject-into-every-subagent assertions.
delete process.env.PONYTAIL_SUBAGENT_MATCHER;
delete process.env.QODER_SESSION_ID;
// Cursor sets these only for hook processes, but a suite launched from a Cursor
// hook would otherwise steer every case into the Cursor JSON branch (#817).
delete process.env.CURSOR_VERSION;
delete process.env.CURSOR_PROJECT_DIR;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hooks-'));
// Runs on normal exit and on assertion-throw exit; force makes it idempotent.
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const home = path.join(temp, 'home');
const pluginData = path.join(temp, 'plugin-data');
fs.mkdirSync(home, { recursive: true });

// USERPROFILE alongside HOME: os.homedir() reads USERPROFILE on Windows, HOME on POSIX.
const codexEnv = {
  HOME: home,
  USERPROFILE: home,
  PLUGIN_DATA: pluginData,
  PONYTAIL_DEFAULT_MODE: 'ultra',
};
const codexState = path.join(pluginData, '.ponytail-active');

let result = run('ponytail-activate.js', codexEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'ultra');
let output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:ULTRA');
assert.equal(output.additionalContext, undefined, 'Codex must not emit additionalContext at top level (#573)');
assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: ultra/,
);

result = run(
  'ponytail-mode-tracker.js',
  codexEnv,
  JSON.stringify({ prompt: '@ponytail lite' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'lite');
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:LITE');

// Querying bare @ponytail should report the active level ('lite') without resetting it to default ('ultra')
result = run(
  'ponytail-mode-tracker.js',
  codexEnv,
  JSON.stringify({ prompt: '@ponytail' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'lite');
output = JSON.parse(result.stdout);
assert.equal(output.additionalContext, undefined, 'Codex must not emit additionalContext at top level (#573)');
assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: lite/,
);

result = run(
  'ponytail-mode-tracker.js',
  codexEnv,
  JSON.stringify({ prompt: 'normal mode' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(codexState), false);
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:OFF');

// A request that merely mentions "normal mode" must not deactivate ponytail.
result = run('ponytail-mode-tracker.js', codexEnv, JSON.stringify({ prompt: '@ponytail lite' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'lite');

result = run(
  'ponytail-mode-tracker.js',
  codexEnv,
  JSON.stringify({ prompt: 'add a normal mode toggle next to dark mode' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(codexState, 'utf8'),
  'lite',
  'incidental "normal mode" in a request must not turn ponytail off',
);

const claudeEnv = {
  HOME: home,
  USERPROFILE: home,
  PONYTAIL_DEFAULT_MODE: 'full',
};
delete claudeEnv.PLUGIN_DATA;

result = run('ponytail-activate.js', claudeEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(path.join(home, '.claude', '.ponytail-active'), 'utf8'),
  'full',
);

// CLAUDE_CONFIG_DIR overrides ~/.claude for the flag file (issue #34).
const home2 = path.join(temp, 'home2');
fs.mkdirSync(home2, { recursive: true });
const customConfigDir = path.join(temp, 'custom-claude');
result = run('ponytail-activate.js', {
  HOME: home2,
  USERPROFILE: home2,
  CLAUDE_CONFIG_DIR: customConfigDir,
  PONYTAIL_DEFAULT_MODE: 'lite',
});
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(path.join(customConfigDir, '.ponytail-active'), 'utf8'),
  'lite',
);
assert.equal(
  fs.existsSync(path.join(home2, '.claude', '.ponytail-active')),
  false,
  'flag must not land in ~/.claude when CLAUDE_CONFIG_DIR is set',
);
// The statusline setup nudge must point at the configured settings.json, not a
// hardcoded ~/.claude (issue #250).
assert.ok(
  result.stdout.includes(path.join(customConfigDir, 'settings.json')),
  'statusline nudge must reference the CLAUDE_CONFIG_DIR settings.json',
);

// #483: the statusline nudge fires at most once — after it writes its flag, a
// later session stays silent instead of re-nagging on every start.
assert.ok(
  fs.existsSync(path.join(customConfigDir, '.ponytail-statusline-nudged')),
  'first nudge must write the once-only flag (#483)',
);
const secondNudge = run('ponytail-activate.js', {
  HOME: home2,
  USERPROFILE: home2,
  CLAUDE_CONFIG_DIR: customConfigDir,
  PONYTAIL_DEFAULT_MODE: 'lite',
});
assert.equal(secondNudge.status, 0, secondNudge.stderr);
assert.ok(
  !secondNudge.stdout.includes('STATUSLINE SETUP NEEDED'),
  'nudge must not repeat once the flag file exists (#483)',
);

const copilotData = path.join(temp, 'copilot-data');
const codexData = path.join(temp, 'codex-data-shadow');
result = run('ponytail-activate.js', {
  HOME: home,
  USERPROFILE: home,
  COPILOT_PLUGIN_DATA: copilotData,
  PLUGIN_DATA: codexData,
  PONYTAIL_DEFAULT_MODE: 'full',
});
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(path.join(copilotData, '.ponytail-active'), 'utf8'), 'full');
assert.equal(
  fs.existsSync(path.join(codexData, '.ponytail-active')),
  false,
  'copilot hooks must not write mode state to codex PLUGIN_DATA',
);
output = JSON.parse(result.stdout);
assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

// VS Code Copilot never sets COPILOT_PLUGIN_DATA — it only injects
// CLAUDE_PLUGIN_ROOT pointed at an agent-plugins/.../.vscode install path
// (#528). Without a fallback, isCopilot was false, so ponytail assumed
// native Claude Code and emitted the statusline nudge — noise, since VS
// Code Copilot doesn't read Claude's statusLine setting.
const vscodeHome = path.join(temp, 'vscode-copilot-home');
const vscodePluginRoot = path.join(
  vscodeHome, '.vscode', 'agent-plugins', 'github.com', 'DietrichGebert', 'ponytail', 'hooks',
);
fs.mkdirSync(vscodeHome, { recursive: true });
result = run('ponytail-activate.js', {
  HOME: vscodeHome,
  USERPROFILE: vscodeHome,
  CLAUDE_PLUGIN_ROOT: vscodePluginRoot,
  PONYTAIL_DEFAULT_MODE: 'full',
});
assert.equal(result.status, 0, result.stderr);
assert.ok(
  !result.stdout.includes('STATUSLINE SETUP NEEDED'),
  'VS Code Copilot (detected via CLAUDE_PLUGIN_ROOT) must not get the Claude-only statusline nudge',
);
// isCopilot must still resolve a state dir even though COPILOT_PLUGIN_DATA
// is unset under VS Code — falling back to ~/.claude, not crashing on an
// undefined path.
assert.equal(
  fs.readFileSync(path.join(vscodeHome, '.claude', '.ponytail-active'), 'utf8'),
  'full',
  'VS Code Copilot must persist mode state under getClaudeDir(), not a path built from the unset COPILOT_PLUGIN_DATA',
);

result = run(
  'ponytail-mode-tracker.js',
  {
    HOME: home,
    USERPROFILE: home,
    COPILOT_PLUGIN_DATA: copilotData,
    PLUGIN_DATA: codexData,
  },
  JSON.stringify({ prompt: '/ponytail ultra' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(path.join(copilotData, '.ponytail-active'), 'utf8'), 'ultra');
assert.equal(
  fs.existsSync(path.join(codexData, '.ponytail-active')),
  false,
  'copilot mode tracker must keep codex PLUGIN_DATA untouched',
);
output = JSON.parse(result.stdout);
assert.deepEqual(output, {});

// SubagentStart hook: when ponytail mode is active it injects the ruleset into
// each subagent (issue #252). Native Claude must get the hookSpecificOutput JSON
// form, not raw stdout, or the context is dropped.
const subHome = path.join(temp, 'sub-home');
const subFlag = path.join(subHome, '.claude', '.ponytail-active');
fs.mkdirSync(path.dirname(subFlag), { recursive: true });
const subEnv = { HOME: subHome, USERPROFILE: subHome };

fs.writeFileSync(subFlag, 'full');
result = run('ponytail-subagent.js', subEnv);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: full/,
);

// No flag → ponytail off → inject nothing (empty stdout, no failure).
fs.unlinkSync(subFlag);
result = run('ponytail-subagent.js', subEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '', 'SubagentStart must stay silent when ponytail is off');

// Codex shares claude-codex-hooks.json, so SubagentStart is reachable under Codex
// too — assert the codex branch emits the badge plus hookSpecificOutput.
const subCodex = path.join(temp, 'sub-codex');
fs.mkdirSync(subCodex, { recursive: true });
fs.writeFileSync(path.join(subCodex, '.ponytail-active'), 'full');
result = run('ponytail-subagent.js', { HOME: subHome, USERPROFILE: subHome, PLUGIN_DATA: subCodex });
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, 'PONYTAIL:FULL');
assert.equal(output.additionalContext, undefined, 'Codex must not emit additionalContext at top level (#573)');
assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

// SubagentStart scoping (issue #506): PONYTAIL_SUBAGENT_MATCHER limits the
// injection to agent types whose name matches the regex. Unset keeps the
// inject-into-every-subagent behavior asserted above. The matcher is
// case-insensitive and unanchored, and every uncertain case fails open.
const scopeHome = path.join(temp, 'scope-home');
const scopeFlag = path.join(scopeHome, '.claude', '.ponytail-active');
fs.mkdirSync(path.dirname(scopeFlag), { recursive: true });
fs.writeFileSync(scopeFlag, 'full');
const scopeEnv = { HOME: scopeHome, USERPROFILE: scopeHome };

// Matching agent_type → inject; the match is case-insensitive.
result = run(
  'ponytail-subagent.js',
  { ...scopeEnv, PONYTAIL_SUBAGENT_MATCHER: 'general|plan' },
  JSON.stringify({ agent_type: 'General-purpose' }),
);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

// agent_type the matcher rejects → stay silent.
result = run(
  'ponytail-subagent.js',
  { ...scopeEnv, PONYTAIL_SUBAGENT_MATCHER: 'general|plan' },
  JSON.stringify({ agent_type: 'Explore' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '', 'a non-matching agent_type must skip the injection');

// Anchored regex → exact match only; a superset name is rejected.
result = run(
  'ponytail-subagent.js',
  { ...scopeEnv, PONYTAIL_SUBAGENT_MATCHER: '^general$' },
  JSON.stringify({ agent_type: 'general-purpose' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '', 'an anchored matcher must not match a superset agent_type');

// Matcher set but agent_type absent → the platform didn't report it; fail
// open and inject rather than silently dropping the persona (issue #252).
result = run(
  'ponytail-subagent.js',
  { ...scopeEnv, PONYTAIL_SUBAGENT_MATCHER: 'general' },
  JSON.stringify({}),
);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

// Invalid regex → must not crash; fall back to injecting everywhere.
result = run(
  'ponytail-subagent.js',
  { ...scopeEnv, PONYTAIL_SUBAGENT_MATCHER: '(' },
  JSON.stringify({ agent_type: 'anything' }),
);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');

// With stdin closed empty (no payload, so no session id) the hook still
// injects from the legacy flag, preserving the #252 behavior on Windows where
// the piped JSON can be swallowed (#443).
result = run('ponytail-subagent.js', scopeEnv, '');
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

// Qoder: no SessionStart event, so UserPromptSubmit does double duty —
// it activates the default mode on first prompt (writes flag), then injects
// the ruleset via additionalContext on every prompt. Output is
// hookSpecificOutput JSON (same shape as Codex minus systemMessage).
const qoderHome = path.join(temp, 'qoder-home');
const qoderState = path.join(qoderHome, '.qoder', '.ponytail-active');
fs.mkdirSync(qoderHome, { recursive: true });

const qoderEnv = {
  HOME: qoderHome,
  USERPROFILE: qoderHome,
  QODER_SESSION_ID: 'test-session-123',
  PONYTAIL_DEFAULT_MODE: 'full',
};

// First prompt: no flag file yet → mode-tracker initializes from default,
// writes flag, and injects the ruleset.
result = run(
  'ponytail-mode-tracker.js',
  qoderEnv,
  JSON.stringify({ prompt: 'write a function' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(qoderState, 'utf8'), 'full');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: full/,
);

// /ponytail ultra: mode tracker updates flag and injects ultra ruleset.
result = run(
  'ponytail-mode-tracker.js',
  qoderEnv,
  JSON.stringify({ prompt: '/ponytail ultra' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(qoderState, 'utf8'), 'ultra');
output = JSON.parse(result.stdout);
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE CHANGED — level: ultra/,
);

// "stop ponytail": deactivates, clears flag, no ruleset output.
result = run(
  'ponytail-mode-tracker.js',
  qoderEnv,
  JSON.stringify({ prompt: 'stop ponytail' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(qoderState), false, 'flag must be cleared after stop ponytail');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.additionalContext, 'PONYTAIL MODE OFF');

// The session recorded 'off', so the next ordinary prompt stays off instead of
// re-initializing the default (off used to last one prompt on Qoder).
result = run('ponytail-mode-tracker.js', qoderEnv, JSON.stringify({ prompt: 'write another function' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '', 'a Qoder session turned off must stay off on the next prompt');

// A new Qoder session starts from the default, not from another session's mode.
result = run('ponytail-mode-tracker.js', qoderEnv, JSON.stringify({ prompt: '/ponytail ultra' }));
result = run(
  'ponytail-mode-tracker.js',
  { ...qoderEnv, QODER_SESSION_ID: 'test-session-456' },
  JSON.stringify({ prompt: 'write a function' }),
);
assert.equal(result.status, 0, result.stderr);
assert.match(
  JSON.parse(result.stdout).hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: full/,
  "a new Qoder session must not inherit another session's level",
);

// Subagent injection via PreToolUse (task|Task matcher): when ponytail is
// active, the subagent hook injects the ruleset. Qoder shares the same
// ponytail-subagent.js script; the isQoder branch outputs hookSpecificOutput
// JSON instead of raw stdout.
run('ponytail-mode-tracker.js', qoderEnv, JSON.stringify({ prompt: '/ponytail full' }));
result = run('ponytail-subagent.js', qoderEnv);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: full/,
);
// Concurrent sessions (#662, #809): each session's mode lives in its own file
// keyed by the payload's session_id, so one session's /ponytail switch, start,
// or "stop ponytail" no longer changes another session's mode.
const multiHome = path.join(temp, 'multi-home');
const multiClaude = path.join(multiHome, '.claude');
const multiSessions = path.join(multiClaude, '.ponytail-sessions');
fs.mkdirSync(multiHome, { recursive: true });
const multiEnv = { HOME: multiHome, USERPROFILE: multiHome, PONYTAIL_DEFAULT_MODE: 'full' };
function hook(script, payload) {
  const r = run(script, multiEnv, JSON.stringify(payload));
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
function subagentLevel(sessionId) {
  const m = hook('ponytail-subagent.js', { session_id: sessionId, agent_type: 'general-purpose' })
    .match(/PONYTAIL MODE ACTIVE — level: (\w+)/);
  return m ? m[1] : null;
}

hook('ponytail-activate.js', { session_id: 'session-a', source: 'startup' });
hook('ponytail-mode-tracker.js', { session_id: 'session-a', prompt: '/ponytail ultra' });
hook('ponytail-activate.js', { session_id: 'session-b', source: 'startup' });
assert.equal(subagentLevel('session-a'), 'ultra', "another session starting must not reset this session's level");
assert.equal(subagentLevel('session-b'), 'full');
assert.equal(subagentLevel('never-started'), 'full', 'a session with no file of its own falls back to the legacy flag');
assert.match(
  hook('ponytail-mode-tracker.js', { session_id: 'session-a', prompt: '/ponytail' }),
  /level: ultra/,
  "bare /ponytail reports this session's level",
);

hook('ponytail-mode-tracker.js', { session_id: 'session-b', prompt: 'stop ponytail' });
assert.equal(subagentLevel('session-b'), null, 'a stopped session injects nothing into its subagents');
assert.equal(subagentLevel('session-a'), 'ultra', "another session's stop must not turn this one off");

// The session id becomes a file name: path characters are dropped, so a
// payload can't write outside the sessions dir.
hook('ponytail-mode-tracker.js', { session_id: '../../escape', prompt: '/ponytail lite' });
assert.equal(fs.readFileSync(path.join(multiSessions, 'escape'), 'utf8'), 'lite');
assert.equal(fs.existsSync(path.join(multiHome, 'escape')), false);

// Session files idle past the TTL are pruned when a new session starts.
const staleSession = path.join(multiSessions, 'stale-session');
fs.writeFileSync(staleSession, 'full');
const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
fs.utimesSync(staleSession, eightDaysAgo, eightDaysAgo);
hook('ponytail-activate.js', { session_id: 'session-c', source: 'startup' });
assert.equal(fs.existsSync(staleSession), false, 'a stale session file must be pruned');
assert.ok(fs.existsSync(path.join(multiSessions, 'session-a')), 'recent session files are kept');

// The statusline gets the session JSON on stdin and shows that session's mode.
// Each shell is exercised where CI can run it: bash off Windows, PowerShell on it.
function statusline(shell, args, sessionId) {
  const r = spawnSync(shell, args, {
    env: { ...process.env, CLAUDE_CONFIG_DIR: multiClaude },
    input: JSON.stringify({ session_id: sessionId, model: { id: 'x' } }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
const statuslineShells = process.platform === 'win32'
  ? [['powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'hooks', 'ponytail-statusline.ps1')]]]
  : [['bash', [path.join(root, 'hooks', 'ponytail-statusline.sh')]]];
for (const [shell, args] of statuslineShells) {
  assert.match(statusline(shell, args, 'session-a'), /\[PONYTAIL:ULTRA\]/, `${shell} statusline: this session's level`);
  assert.equal(statusline(shell, args, 'session-b'), '', `${shell} statusline: a stopped session shows nothing`);
  assert.match(statusline(shell, args, 'never-started'), /\[PONYTAIL\]/, `${shell} statusline: falls back to the legacy flag`);
}

// writeDefaultMode must merge into existing config, not overwrite it (#490).
const mergeHome = path.join(temp, 'merge-home');
const mergeConfigDir = path.join(mergeHome, '.config', 'ponytail');
fs.mkdirSync(mergeConfigDir, { recursive: true });
const mergeConfigPath = path.join(mergeConfigDir, 'config.json');
fs.writeFileSync(mergeConfigPath, JSON.stringify({ defaultMode: 'full', customSetting: 42 }, null, 2));

const prevXdg = process.env.XDG_CONFIG_HOME;
process.env.XDG_CONFIG_HOME = path.join(mergeHome, '.config');
try {
  writeDefaultMode('ultra');
  const merged = JSON.parse(fs.readFileSync(mergeConfigPath, 'utf8'));
  assert.equal(merged.defaultMode, 'ultra', 'writeDefaultMode must update defaultMode');
  assert.equal(merged.customSetting, 42, 'writeDefaultMode must preserve existing config fields');
} finally {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
}

// #329: `/ponytail default <mode>` persists the default to config (survives
// restart), while a plain switch stays session-scoped and never touches config.
const defHome = path.join(temp, 'default-cmd-home');
const defEnv = { HOME: defHome, USERPROFILE: defHome, XDG_CONFIG_HOME: path.join(defHome, '.config') };
const defConfig = path.join(defHome, '.config', 'ponytail', 'config.json');
const defFlag = path.join(defHome, '.claude', '.ponytail-active');

result = run('ponytail-mode-tracker.js', defEnv, JSON.stringify({ prompt: '/ponytail default lite' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(fs.readFileSync(defConfig, 'utf8')).defaultMode, 'lite', '/ponytail default must persist the default');
assert.equal(fs.existsSync(defFlag), false, '/ponytail default must not change the session mode');

// A plain switch is transient: sets the session flag, leaves the default alone.
result = run('ponytail-mode-tracker.js', defEnv, JSON.stringify({ prompt: '/ponytail ultra' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(defFlag, 'utf8'), 'ultra', 'plain switch must set the session mode');
assert.equal(JSON.parse(fs.readFileSync(defConfig, 'utf8')).defaultMode, 'lite', 'plain switch must not persist the default');

// review is not a valid default (#377) — the command is ignored, config unchanged.
result = run('ponytail-mode-tracker.js', defEnv, JSON.stringify({ prompt: '/ponytail default review' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(JSON.parse(fs.readFileSync(defConfig, 'utf8')).defaultMode, 'lite', 'review must not be accepted as a default');

// review must be refused as a default by the config functions too, not only the
// mode-tracker command path (#377): writing it is a no-op, and a stray
// PONYTAIL_DEFAULT_MODE=review falls back to the built-in default.
const revHome = path.join(temp, 'review-default-home');
const revConfigDir = path.join(revHome, '.config', 'ponytail');
fs.mkdirSync(revConfigDir, { recursive: true });
const revConfigPath = path.join(revConfigDir, 'config.json');
fs.writeFileSync(revConfigPath, JSON.stringify({ defaultMode: 'lite' }, null, 2));

const prevXdgRev = process.env.XDG_CONFIG_HOME;
const prevEnvModeRev = process.env.PONYTAIL_DEFAULT_MODE;
process.env.XDG_CONFIG_HOME = path.join(revHome, '.config');
try {
  assert.equal(writeDefaultMode('review'), null, 'writeDefaultMode must refuse review as a default (#377)');
  assert.equal(JSON.parse(fs.readFileSync(revConfigPath, 'utf8')).defaultMode, 'lite', 'a refused review write must leave the config unchanged');

  delete process.env.PONYTAIL_DEFAULT_MODE;
  fs.rmSync(revConfigPath);
  process.env.PONYTAIL_DEFAULT_MODE = 'review';
  assert.equal(getDefaultMode(), DEFAULT_MODE, 'PONYTAIL_DEFAULT_MODE=review must fall back to the built-in default');
} finally {
  if (prevXdgRev === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = prevXdgRev;
  if (prevEnvModeRev === undefined) delete process.env.PONYTAIL_DEFAULT_MODE; else process.env.PONYTAIL_DEFAULT_MODE = prevEnvModeRev;
}

console.log('hook compatibility checks passed');
