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
const { getPonytailInstructions } = require('../hooks/ponytail-instructions');
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
delete process.env.ZCODE_APP_VERSION;
// A leaked project dir would move the flag into ponytail-modes/ (#662).
delete process.env.CLAUDE_PROJECT_DIR;
// Cursor sets these only for hook processes, but a suite launched from a Cursor
// hook would otherwise steer every case into the Cursor JSON branch (#817).
delete process.env.CURSOR_VERSION;
delete process.env.CURSOR_PROJECT_DIR;
// Same for CodeBuddy (#854), which sets these only for its plugin hook processes.
delete process.env.CODEBUDDY_PLUGIN_ROOT;
delete process.env.CODEBUDDY_CONFIG_DIR;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hooks-'));
// Runs on normal exit and on assertion-throw exit; force makes it idempotent.
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

const home = path.join(temp, 'home');
const pluginData = path.join(temp, 'plugin-data');
fs.mkdirSync(home, { recursive: true });

// Off-mode SessionStart must clear stale state without emitting model-visible
// output on any harness.
for (const { label, env, statePath } of [
  {
    label: 'Claude',
    env: { HOME: home, USERPROFILE: home, PONYTAIL_DEFAULT_MODE: 'off' },
    statePath: path.join(home, '.claude', '.ponytail-active'),
  },
  {
    label: 'Codex',
    env: {
      HOME: home,
      USERPROFILE: home,
      PLUGIN_DATA: pluginData,
      PONYTAIL_DEFAULT_MODE: 'off',
    },
    statePath: path.join(pluginData, '.ponytail-active'),
  },
  {
    label: 'Copilot',
    env: {
      HOME: home,
      USERPROFILE: home,
      COPILOT_PLUGIN_DATA: path.join(temp, 'copilot-off-data'),
      PONYTAIL_DEFAULT_MODE: 'off',
    },
    statePath: path.join(temp, 'copilot-off-data', '.ponytail-active'),
  },
]) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, 'full');
  const offResult = run('ponytail-activate.js', env);
  assert.equal(offResult.status, 0, offResult.stderr);
  assert.equal(offResult.stdout, '', `${label} SessionStart must stay silent when ponytail is off`);
  assert.equal(fs.existsSync(statePath), false, `${label} stale mode state must be cleared`);
}

function collectManifestCommands(file, field) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const commands = [];

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value[field] === 'string') commands.push(value[field]);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }

  visit(manifest);
  return commands;
}

function runShell(command, env, input = '') {
  return spawnSync('/bin/sh', ['-c', command], {
    env,
    input,
    encoding: 'utf8',
  });
}

let result;

// These run the manifest commands through /bin/sh, which native Windows lacks
// (#774); skip them there so the rest of this file still runs.
if (fs.existsSync('/bin/sh')) {
  // The shared Claude/Codex command must stay guard-free: VS Code runs it in
  // Windows PowerShell, which cannot parse `||` (see hooks-windows.test.js), so
  // it only has to run clean with node.
  // WSL2 can hand hooks a backslashed root (\home\user\...); the commands turn it
  // back into a POSIX path, so both shapes must load the script (#646).
  const roots = [root, root.split(path.sep).join('\\')];

  for (const command of collectManifestCommands('hooks/claude-codex-hooks.json', 'command')) {
    for (const pluginRoot of roots) {
      result = runShell(command, { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PLUGIN_ROOT: pluginRoot });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '', command);
    }
  }

  // Copilot CLI has a separate bash field, so it can exit 0 without node (#645).
  // `|| exit 0` also hides a broken hook, so the with-node run must leave stderr empty.
  for (const command of collectManifestCommands('hooks/copilot-hooks.json', 'bash')) {
    for (const pluginRoot of roots) {
      const env = { HOME: home, USERPROFILE: home, PLUGIN_ROOT: pluginRoot, COPILOT_PLUGIN_DATA: path.join(temp, 'copilot-manifest-data') };
      result = runShell(command, { ...process.env, ...env });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '', command);

      result = runShell(command, { ...env, PATH: '' });
      assert.equal(result.status, 0, result.stderr);
    }
  }
}

// USERPROFILE alongside HOME: os.homedir() reads USERPROFILE on Windows, HOME on POSIX.
const codexEnv = {
  HOME: home,
  USERPROFILE: home,
  PLUGIN_DATA: pluginData,
  PONYTAIL_DEFAULT_MODE: 'ultra',
};
const codexState = path.join(pluginData, '.ponytail-active');

result = run('ponytail-activate.js', codexEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codexState, 'utf8'), 'ultra');
let output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, undefined, 'Codex must not emit systemMessage — Codex renders it as a yellow warning: line (#605)');
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
assert.equal(output.systemMessage, undefined, 'Codex must not emit systemMessage (#605)');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /level: lite/,
  'mode still surfaces via the hook context line',
);
// The switch carries the new level's ruleset: the SessionStart one is filtered
// to the start level, and `$ponytail lite` does not load the skill body.
assert.ok(output.hookSpecificOutput.additionalContext.endsWith(getPonytailInstructions('lite')));

for (const [prompt, mode] of [
  ['$ponytail full', 'full'],
  ['@ponytail ultra', 'ultra'],
  ['/ponytail:ponytail lite', 'lite'],
]) {
  result = run('ponytail-mode-tracker.js', codexEnv, JSON.stringify({ prompt }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(codexState, 'utf8'), mode);
  output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.ok(output.hookSpecificOutput.additionalContext.endsWith(getPonytailInstructions(mode)));
}

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
assert.equal(output.systemMessage, undefined, 'Codex must not emit systemMessage (#605)');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE OFF/,
  'deactivation still surfaces via the hook context line',
);

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
// too — assert the codex branch emits hookSpecificOutput and no systemMessage (#605).
const subCodex = path.join(temp, 'sub-codex');
fs.mkdirSync(subCodex, { recursive: true });
fs.writeFileSync(path.join(subCodex, '.ponytail-active'), 'full');
result = run('ponytail-subagent.js', { HOME: subHome, USERPROFILE: subHome, PLUGIN_DATA: subCodex });
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, undefined, 'Codex must not emit systemMessage (#605)');
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

// Catastrophic-backtracking matcher → must not hang the hook (#658); the
// match is time-boxed and a timeout fails open and injects.
result = run(
  'ponytail-subagent.js',
  { ...scopeEnv, PONYTAIL_SUBAGENT_MATCHER: '(a+)+$' },
  JSON.stringify({ agent_type: 'a'.repeat(40) + '!' }),
);
assert.equal(result.status, 0, result.stderr);
output = JSON.parse(result.stdout);
assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: full/);

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

// Bare `/ponytail` on Qoder is report-only: there's no SessionStart, so the
// double-duty block below emits the full ruleset as the report. A second
// confirmation here would push two JSON objects to stdout. The point is that
// the user still gets the ruleset back as one object.
result = run(
  'ponytail-mode-tracker.js',
  qoderEnv,
  JSON.stringify({ prompt: '/ponytail' }),
);
assert.equal(result.status, 0, result.stderr);
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

// "stop ponytail": deactivates and persists off so a later prompt does
// not mistake the missing flag for first-run initialization.
result = run(
  'ponytail-mode-tracker.js',
  qoderEnv,
  JSON.stringify({ prompt: 'stop ponytail' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(qoderState, 'utf8'), 'off');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.additionalContext, 'PONYTAIL MODE OFF');

result = run(
  'ponytail-mode-tracker.js',
  qoderEnv,
  JSON.stringify({ prompt: 'write another function' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '', 'Qoder must stay off on later prompts');
assert.equal(fs.readFileSync(qoderState, 'utf8'), 'off');

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

// CodeBuddy (#854): installs the Claude-format plugin as-is and runs its hooks
// with CODEBUDDY_PLUGIN_ROOT set. The mode flag must live in ~/.codebuddy, not
// ~/.claude, so a CodeBuddy session can't flip a Claude Code session's mode,
// and output is hookSpecificOutput JSON with no Claude statusline nudge.
const codebuddyHome = path.join(temp, 'codebuddy-home');
const codebuddyState = path.join(codebuddyHome, '.codebuddy', '.ponytail-active');
fs.mkdirSync(codebuddyHome, { recursive: true });
const codebuddyEnv = {
  HOME: codebuddyHome,
  USERPROFILE: codebuddyHome,
  CODEBUDDY_PLUGIN_ROOT: root,
  CLAUDE_PLUGIN_ROOT: root,
  PONYTAIL_DEFAULT_MODE: 'lite',
};

result = run('ponytail-activate.js', codebuddyEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codebuddyState, 'utf8'), 'lite');
assert.equal(fs.existsSync(path.join(codebuddyHome, '.claude', '.ponytail-active')), false,
  'CodeBuddy must not write the Claude Code mode flag');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
assert.match(output.hookSpecificOutput.additionalContext, /PONYTAIL MODE ACTIVE — level: lite/);
assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /STATUSLINE SETUP NEEDED/);

// Plugin skills are namespaced in CodeBuddy, so the switch arrives as /ponytail:ponytail.
result = run(
  'ponytail-mode-tracker.js',
  codebuddyEnv,
  JSON.stringify({ prompt: '/ponytail:ponytail ultra' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(codebuddyState, 'utf8'), 'ultra');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.additionalContext, 'PONYTAIL MODE CHANGED — level: ultra');

// CODEBUDDY_CONFIG_DIR moves CodeBuddy's home, and the flag moves with it.
const codebuddyConfigDir = path.join(temp, 'codebuddy-config');
result = run('ponytail-activate.js', { ...codebuddyEnv, CODEBUDDY_CONFIG_DIR: codebuddyConfigDir });
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(path.join(codebuddyConfigDir, '.ponytail-active'), 'utf8'), 'lite');

// Zcode: parses hook stdout as strict JSON, so the native-Claude raw-text
// SessionStart output is silently discarded (#798). Same hookSpecificOutput
// shape as Qoder, but Zcode does have SessionStart — activate.js injects the
// ruleset at startup and the mode-tracker only speaks up on mode switches.
const zcodeHome = path.join(temp, 'zcode-home');
const zcodeState = path.join(zcodeHome, '.claude', '.ponytail-active');
fs.mkdirSync(zcodeHome, { recursive: true });

const zcodeEnv = {
  HOME: zcodeHome,
  USERPROFILE: zcodeHome,
  ZCODE_APP_VERSION: '3.10.2',
  PONYTAIL_DEFAULT_MODE: 'full',
};

// SessionStart: flag written, ruleset emitted as hookSpecificOutput JSON.
result = run('ponytail-activate.js', zcodeEnv);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(zcodeState, 'utf8'), 'full');
output = JSON.parse(result.stdout);
assert.equal(output.systemMessage, undefined, 'Zcode must not emit systemMessage');
assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE ACTIVE — level: full/,
);

// '@ponytail lite': mode tracker updates the flag and confirms via JSON.
result = run(
  'ponytail-mode-tracker.js',
  zcodeEnv,
  JSON.stringify({ prompt: '@ponytail lite' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(zcodeState, 'utf8'), 'lite');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
assert.match(
  output.hookSpecificOutput.additionalContext,
  /PONYTAIL MODE CHANGED — level: lite/,
);

// "stop ponytail": deactivates, clears flag, short confirmation as JSON.
result = run(
  'ponytail-mode-tracker.js',
  zcodeEnv,
  JSON.stringify({ prompt: 'stop ponytail' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.existsSync(zcodeState), false, 'flag must be cleared after stop ponytail');
output = JSON.parse(result.stdout);
assert.equal(output.hookSpecificOutput.additionalContext, 'PONYTAIL MODE OFF');
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

// An unsupported mode is a no-op: it must not reset the active session mode
// to the configured default.
result = run('ponytail-mode-tracker.js', defEnv, JSON.stringify({ prompt: '/ponytail ulta' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '');
assert.equal(fs.readFileSync(defFlag, 'utf8'), 'ultra', 'invalid mode must preserve the active session mode');

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

// Normal path stays fast: 'end' exits explicitly, so the (now ref'd) fallback
// timer never adds its full 1000ms to a prompt that does reach EOF.
{
  const t0 = Date.now();
  const r = run('ponytail-mode-tracker.js', codexEnv, JSON.stringify({ prompt: 'hi' }));
  assert.equal(r.status, 0, r.stderr);
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 800, `normal path took ${elapsed}ms; ref'd fallback timer is delaying EOF exits`);
}

// #790: when stdin never emits 'end' (the Windows PowerShell wrapper can
// swallow the piped JSON, #443), the hook must still exit on its own via the
// 1000ms fallback timer — not hang until the host's external watchdog kills
// it. An unref'd timer never fired in that state on Windows (a ref'd stdin
// keeps the loop alive and the unref'd timer is never scheduled), so the
// fallback was dead code exactly where it was needed. The timer is now ref'd;
// the normal 'end' path exits explicitly (checked above) so the ref'd timer
// adds no latency. spawnSync's timeout acts as the watchdog: status null /
// SIGTERM means the hook hung past 2500ms instead of exiting on its 1s
// fallback. The unref starvation itself is Windows-only (a POSIX pipe lets the
// unref'd timer fire), so the ref'd-timer contract is also asserted
// statically below.
{
  const hangHome = path.join(temp, 'hang-home');
  fs.mkdirSync(hangHome, { recursive: true });
  const hangEnv = { HOME: hangHome, USERPROFILE: hangHome, CLAUDE_CONFIG_DIR: hangHome };
  for (const script of ['ponytail-mode-tracker.js', 'ponytail-subagent.js']) {
    const r = spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
      env: { ...process.env, ...hangEnv },
      timeout: 2500,
      encoding: 'utf8',
    });
    assert.notEqual(r.status, null, `${script} never exited on its fallback with open stdin (#790)`);
    assert.equal(r.status, 0, `${script} exited non-zero on its fallback (#790): ${r.stderr}`);
    assert.ok(r.signal === null || r.signal === undefined, `${script} was watchdog-killed; 1s fallback did not fire (#790)`);

    const src = fs.readFileSync(path.join(root, 'hooks', script), 'utf8');
    assert.ok(
      !src.includes('.unref('),
      `${script} fallback timer must stay ref'd (#790): an unref'd timer never fires while a stuck ref'd stdin keeps the loop alive on Windows`,
    );
  }
}

// #736: /ponytail-review is a one-shot skill, not a session level. Persisting
// `review` makes every later getPonytailInstructions() return a pointer line.
const latchHome = path.join(temp, 'review-latch-home');
const latchFlag = path.join(latchHome, '.claude', '.ponytail-active');
fs.mkdirSync(path.dirname(latchFlag), { recursive: true });
const latchEnv = { HOME: latchHome, USERPROFILE: latchHome };

fs.writeFileSync(latchFlag, 'full');
result = run('ponytail-mode-tracker.js', latchEnv, JSON.stringify({ prompt: '/ponytail-review' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(latchFlag, 'utf8'),
  'full',
  '/ponytail-review must leave an active level untouched (#736)',
);

result = run(
  'ponytail-mode-tracker.js',
  latchEnv,
  JSON.stringify({ prompt: '/ponytail:ponytail-review src/app.js' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.readFileSync(latchFlag, 'utf8'),
  'full',
  'namespaced /ponytail:ponytail-review must not latch review either (#736)',
);

fs.unlinkSync(latchFlag);
result = run('ponytail-mode-tracker.js', latchEnv, JSON.stringify({ prompt: '/ponytail-review' }));
assert.equal(result.status, 0, result.stderr);
assert.equal(
  fs.existsSync(latchFlag),
  false,
  '/ponytail-review must not create a review flag on a fresh session (#736)',
);

// #662/#809: two Claude Code sessions in different repos keep their own mode.
{
  const projHome = path.join(temp, 'per-project-home');
  fs.mkdirSync(projHome, { recursive: true });
  const repoA = { HOME: projHome, USERPROFILE: projHome, CLAUDE_PROJECT_DIR: '/work/repo-a' };
  const repoB = { HOME: projHome, USERPROFILE: projHome, CLAUDE_PROJECT_DIR: '/work/repo-b' };
  const subagentLevel = (env) => {
    const r = run('ponytail-subagent.js', env);
    assert.equal(r.status, 0, r.stderr);
    if (!r.stdout) return null;
    return JSON.parse(r.stdout).hookSpecificOutput.additionalContext.match(/level: (\w+)/)[1];
  };

  run('ponytail-activate.js', repoA);
  run('ponytail-activate.js', { ...repoB, PONYTAIL_DEFAULT_MODE: 'off' });
  assert.equal(subagentLevel(repoA), 'full', 'an off session in repo B must not clear repo A');
  assert.equal(subagentLevel(repoB), null, 'repo B is off');

  run('ponytail-mode-tracker.js', repoA, JSON.stringify({ prompt: '/ponytail ultra' }));
  run('ponytail-mode-tracker.js', repoB, JSON.stringify({ prompt: '/ponytail lite' }));
  assert.equal(subagentLevel(repoA), 'ultra');
  assert.equal(subagentLevel(repoB), 'lite');

  run('ponytail-mode-tracker.js', repoB, JSON.stringify({ prompt: '/ponytail off' }));
  assert.equal(subagentLevel(repoB), null, '/ponytail off works in repo B');
  assert.equal(subagentLevel(repoA), 'ultra', '/ponytail off in repo B leaves repo A alone');
}

// #639: bare /ponytail switches ponytail on when it is off, and only reports
// (never resets) the level when it is already on.
{
  const bareHome = path.join(temp, 'bare-home');
  const bareFlag = path.join(bareHome, '.claude', '.ponytail-active');
  fs.mkdirSync(path.dirname(bareFlag), { recursive: true });
  const bareEnv = { HOME: bareHome, USERPROFILE: bareHome };
  const bare = (env) => run('ponytail-mode-tracker.js', env, JSON.stringify({ prompt: '/ponytail' }));

  fs.writeFileSync(bareFlag, 'ultra');
  assert.match(bare(bareEnv).stdout, /PONYTAIL MODE ACTIVE — level: ultra/);
  assert.equal(fs.readFileSync(bareFlag, 'utf8'), 'ultra', 'checking the level must not reset ultra');

  fs.unlinkSync(bareFlag);
  assert.match(bare(bareEnv).stdout, /PONYTAIL MODE CHANGED — level: full/);
  assert.equal(fs.readFileSync(bareFlag, 'utf8'), 'full', 'bare /ponytail switches an off session on');

  fs.unlinkSync(bareFlag);
  bare({ ...bareEnv, PONYTAIL_DEFAULT_MODE: 'off' });
  assert.equal(fs.readFileSync(bareFlag, 'utf8'), 'full', 'an off default still switches on at full');
}

console.log('hook compatibility checks passed');
