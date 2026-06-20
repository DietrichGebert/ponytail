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
const { isShellSafe } = require('../hooks/ponytail-config');
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

// Keep the base env clean so the default-dir checks are deterministic; the
// CLAUDE_CONFIG_DIR case sets it explicitly.
delete process.env.CLAUDE_CONFIG_DIR;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-hooks-'));
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

const kiroEnv = {
  HOME: home,
  USERPROFILE: home,
  PLUGIN_DATA: path.join(temp, 'kiro-plugin-data-shadow'),
  PONYTAIL_HOST: 'kiro',
  PONYTAIL_DEFAULT_MODE: 'full',
};

result = spawnSync(process.execPath, ['-e', `
process.env.PONYTAIL_HOST = 'kiro';
process.env.PLUGIN_DATA = 'shadow';
const r = require('./hooks/ponytail-runtime');
console.log(JSON.stringify({ isKiro: r.isKiro, isCodex: r.isCodex, isCopilot: r.isCopilot }));
`], {
  cwd: root,
  env: { ...process.env, HOME: home, USERPROFILE: home },
  encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr);
assert.deepEqual(JSON.parse(result.stdout), { isKiro: true, isCodex: false, isCopilot: false });

result = run('ponytail-activate.js', kiroEnv, JSON.stringify({ hook_event_name: 'agentSpawn' }));
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /PONYTAIL MODE ACTIVE — level: full/);
assert.doesNotMatch(result.stdout, /STATUSLINE SETUP NEEDED/);
assert.equal(fs.readFileSync(path.join(home, '.kiro', 'ponytail', '.ponytail-active'), 'utf8'), 'full');
assert.equal(
  fs.existsSync(path.join(kiroEnv.PLUGIN_DATA, '.ponytail-active')),
  false,
  'kiro hooks must not write mode state to codex PLUGIN_DATA',
);

const kiroHome = path.join(temp, 'custom-kiro-home');
const kiroDefaultHome = path.join(temp, 'kiro-default-home');
fs.mkdirSync(kiroDefaultHome, { recursive: true });
result = run('ponytail-activate.js', {
  HOME: kiroDefaultHome,
  USERPROFILE: kiroDefaultHome,
  KIRO_HOME: kiroHome,
  PONYTAIL_HOST: 'kiro',
  PONYTAIL_DEFAULT_MODE: 'lite',
});
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(path.join(kiroHome, 'ponytail', '.ponytail-active'), 'utf8'), 'lite');
assert.equal(
  fs.existsSync(path.join(kiroDefaultHome, '.kiro', 'ponytail', '.ponytail-active')),
  false,
  'KIRO_HOME must keep a custom-profile run out of the default ~/.kiro state dir',
);

result = run(
  'ponytail-mode-tracker.js',
  kiroEnv,
  JSON.stringify({ hook_event_name: 'userPromptSubmit', prompt: '/ponytail ultra' }),
);
assert.equal(result.status, 0, result.stderr);
assert.equal(fs.readFileSync(path.join(home, '.kiro', 'ponytail', '.ponytail-active'), 'utf8'), 'ultra');
assert.match(result.stdout, /PONYTAIL MODE CHANGED — level: ultra/);
assert.throws(() => JSON.parse(result.stdout), SyntaxError, 'kiro hook output must stay raw text');

const kiroConfig = JSON.parse(fs.readFileSync(path.join(root, '.kiro', 'agents', 'ponytail.json'), 'utf8'));
assert.equal(kiroConfig.name, 'ponytail');
assert.match(kiroConfig.hooks.agentSpawn[0].command, /PONYTAIL_HOST=kiro/);
assert.match(kiroConfig.hooks.agentSpawn[0].command, /\$\{KIRO_HOME:-\$HOME\/\.kiro\}/);
assert.match(kiroConfig.hooks.userPromptSubmit[0].command, /PONYTAIL_HOST=kiro/);
assert.match(kiroConfig.hooks.userPromptSubmit[0].command, /\$\{KIRO_HOME:-\$HOME\/\.kiro\}/);
assert.equal(kiroConfig.hooks.agentSpawn[0].timeout_ms, 5000);
assert.doesNotMatch(kiroConfig.prompt, /The best code is the code never written/);
assert.ok(kiroConfig.resources.includes('skill://~/.kiro/skills/*/SKILL.md'));

fs.rmSync(temp, { recursive: true, force: true });
console.log('hook compatibility checks passed');
