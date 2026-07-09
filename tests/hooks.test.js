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
const { isShellSafe, writeDefaultMode } = require('../hooks/ponytail-config');
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
assert.match(
  output.additionalContext,
  /PONYTAIL MODE ACTIVE — level: ultra/,
);
assert.equal(output.hookSpecificOutput, undefined, 'Codex should not use hookSpecificOutput (#505)');

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
assert.match(
  output.additionalContext,
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
assert.ok(output.additionalContext, 'Codex SubagentStart should have additionalContext at top level (#505)');
assert.match(output.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

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

// The default (no matcher) path must not depend on stdin: even with stdin
// closed empty it injects synchronously, preserving the #252 behavior on
// Windows where the piped JSON can be swallowed (#443).
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

// Subagent injection via PreToolUse (task|Task matcher): when ponytail is
// active, the subagent hook injects the ruleset. Qoder shares the same
// ponytail-subagent.js script; the isQoder branch outputs hookSpecificOutput
// JSON instead of raw stdout.
fs.writeFileSync(qoderState, 'full');
result = run('ponytail-subagent.js', qoderEnv);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'SubagentStart');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: full/,
);
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

console.log('hook compatibility checks passed');
