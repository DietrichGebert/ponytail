#!/usr/bin/env node
// Smoke test for the Kimi Code adapter: the hooks template stays mergeable,
// the runtime detects the host from env or payload client_type, and hook
// output is plain text (Kimi Code appends stdout to the model context on
// exit 0 — there is no hookSpecificOutput JSON form).
// https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-kimi-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

// Base env with every host signal scrubbed (run() spreads process.env, so a
// leaked PLUGIN_DATA/QODER_SESSION_ID from the dev shell would steer the
// runtime into the wrong branch). KIMI_CODE_HOME is set per-case.
function cleanEnv(extra = {}) {
  const env = { ...process.env };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.PLUGIN_DATA;
  delete env.COPILOT_PLUGIN_DATA;
  delete env.QODER_SESSION_ID;
  delete env.KIMI_CODE_HOME;
  delete env.PONYTAIL_SUBAGENT_MATCHER;
  delete env.PONYTAIL_DEFAULT_MODE;
  return { ...env, ...extra };
}

function run(script, env, input = '') {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: cleanEnv(env),
    input,
    encoding: 'utf8',
  });
}

// Shape observed from a live kimi 0.38 session: prompt is an array of
// content parts, not a plain string.
function kimiPayload(prompt) {
  return JSON.stringify({
    hook_event_name: 'UserPromptSubmit',
    session_id: 's',
    client_type: 'kimi_code_cli',
    cwd: '/tmp',
    prompt: [{ type: 'text', text: prompt }],
    is_steer: false,
  });
}

function assertPlainTextRuleset(stdout, mode) {
  assert.ok(!stdout.trimStart().startsWith('{'), 'Kimi output must be plain text, not JSON');
  assert.ok(!stdout.includes('hookSpecificOutput'), 'Kimi output must not use hookSpecificOutput');
  assert.match(stdout, new RegExp('PONYTAIL MODE (ACTIVE|CHANGED) — level: ' + mode));
  assert.match(stdout, /lazy senior developer/);
}

test('kimi-code-hooks.toml registers UserPromptSubmit with only valid keys', () => {
  const toml = fs.readFileSync(path.join(root, 'hooks', 'kimi-code-hooks.toml'), 'utf8');
  assert.ok(toml.includes('event = "UserPromptSubmit"'), 'must register UserPromptSubmit');
  assert.ok(toml.includes('ponytail-mode-tracker.js'), 'must point at ponytail-mode-tracker.js');
  // A [[hooks]] block accepts only event/matcher/command/timeout; any other
  // key makes ~/.kimi-code/config.toml fail to load. Comment lines (# ...)
  // are ignored by this scan, so the commented-out PreToolUse template is safe.
  const keys = [...toml.matchAll(/^([A-Za-z_]+)\s*=/gm)].map((m) => m[1]);
  assert.ok(keys.length > 0, 'toml must set keys');
  for (const key of keys) {
    assert.ok(['event', 'matcher', 'command', 'timeout'].includes(key), `invalid [[hooks]] key: ${key}`);
  }
  // Subagent injection is documented as unavailable (kimi 0.38 discards
  // PreToolUse stdout; SubagentStart is observation-only), with a commented
  // block ready — the file must keep that guidance and the Agent tool name.
  assert.ok(toml.includes('SubagentStart'), 'must document the SubagentStart limitation');
  assert.ok(toml.includes('# matcher = "Agent"'), 'must keep the commented PreToolUse block scoped to the Agent tool');
});

test('mode-tracker detects kimi via payload client_type and injects plain text', () => {
  const home = path.join(temp, 'home-payload');
  fs.mkdirSync(home, { recursive: true });
  // No KIMI_CODE_HOME — the payload's client_type is the only host signal, so
  // the flag must land under the default ~/.kimi-code.
  const env = { HOME: home, USERPROFILE: home };
  const flag = path.join(home, '.kimi-code', '.ponytail-active');

  // /ponytail full activates the mode; confirmation folds into the ruleset.
  let result = run('ponytail-mode-tracker.js', env, kimiPayload('/ponytail full'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(flag, 'utf8'), 'full');
  assertPlainTextRuleset(result.stdout, 'full');
  assert.match(result.stdout, /^PONYTAIL MODE CHANGED — level: full/);

  // An ordinary prompt gets the ruleset as plain text on stdout, exit 0.
  result = run('ponytail-mode-tracker.js', env, kimiPayload('hello'));
  assert.equal(result.status, 0, result.stderr);
  assertPlainTextRuleset(result.stdout, 'full');
  assert.match(result.stdout, /^PONYTAIL MODE ACTIVE — level: full/);

  // Mode switch updates the flag and injects at the new level.
  result = run('ponytail-mode-tracker.js', env, kimiPayload('/ponytail lite'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(flag, 'utf8'), 'lite');
  assertPlainTextRuleset(result.stdout, 'lite');

  // /ponytail off clears the flag and says so in plain text.
  result = run('ponytail-mode-tracker.js', env, kimiPayload('/ponytail off'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(flag), false, 'flag must be cleared after /ponytail off');
  assert.equal(result.stdout.trim(), 'PONYTAIL MODE OFF');

  // State must not leak into the Claude dir of this fake home.
  assert.equal(
    fs.existsSync(path.join(home, '.claude', '.ponytail-active')),
    false,
    'kimi state must stay under the kimi home',
  );
});

test('mode-tracker detects kimi via KIMI_CODE_HOME and activates the default', () => {
  const home = path.join(temp, 'home-env');
  const kimiHome = path.join(temp, 'kimi-code-home');
  fs.mkdirSync(home, { recursive: true });
  const env = { HOME: home, USERPROFILE: home, KIMI_CODE_HOME: kimiHome };
  const flag = path.join(kimiHome, '.ponytail-active');

  // First prompt, no flag, no client_type: env detection activates the
  // default mode and injects the ruleset.
  const result = run(
    'ponytail-mode-tracker.js',
    env,
    JSON.stringify({ prompt: 'write a function' }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(flag, 'utf8'), 'full');
  assertPlainTextRuleset(result.stdout, 'full');
});

test('writeHookOutput kimi branch writes plain text for both events', () => {
  const snippet = (event) => `
    process.env.KIMI_CODE_HOME = ${JSON.stringify(path.join(temp, 'kimi-hook-output'))};
    const r = require(${JSON.stringify(path.join(root, 'hooks', 'ponytail-runtime.js'))});
    r.writeHookOutput(${JSON.stringify(event)}, 'full', 'RULESET-TEXT');
  `;
  for (const event of ['UserPromptSubmit', 'PreToolUse']) {
    const result = spawnSync(process.execPath, ['-e', snippet(event)], {
      env: cleanEnv(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'RULESET-TEXT', `${event}: stdout must be the raw context`);
  }
});

test('subagent hook emits plain text under kimi', () => {
  const home = path.join(temp, 'home-sub');
  const kimiHome = path.join(temp, 'kimi-code-sub');
  fs.mkdirSync(kimiHome, { recursive: true });
  fs.writeFileSync(path.join(kimiHome, '.ponytail-active'), 'full');

  const result = run('ponytail-subagent.js', { HOME: home, USERPROFILE: home, KIMI_CODE_HOME: kimiHome });
  assert.equal(result.status, 0, result.stderr);
  assertPlainTextRuleset(result.stdout, 'full');
});

test('isKimi is false without env or payload and flips via setKimiFromClientType', () => {
  delete process.env.KIMI_CODE_HOME;
  const runtime = require('../hooks/ponytail-runtime');
  assert.equal(runtime.isKimi, false, 'isKimi must be false without KIMI_CODE_HOME');
  assert.equal(runtime.setKimiFromClientType('claude_code'), false, 'other clients must not flip isKimi');
  assert.equal(runtime.setKimiFromClientType('kimi_code_cli'), true, 'kimi_code_cli must flip isKimi');
  assert.equal(runtime.isKimi, true, 'the exported getter must reflect the runtime flip');
});
