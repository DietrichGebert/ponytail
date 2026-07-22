#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

function workspace(t, defaultMode = 'off') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-codex-lifecycle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    env: {
      ...process.env,
      HOME: path.join(dir, 'home'),
      USERPROFILE: path.join(dir, 'home'),
      XDG_CONFIG_HOME: path.join(dir, 'config'),
      PLUGIN_DATA: path.join(dir, 'plugin-data'),
      PONYTAIL_DEFAULT_MODE: defaultMode,
      COPILOT_PLUGIN_DATA: '',
      QODER_SESSION_ID: '',
    },
  };
}

function runHook(script, env, payload) {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env,
    input: payload === undefined ? '' : JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 4000,
  });
}

function payloadBase(env, sessionId, event) {
  return {
    session_id: sessionId,
    transcript_path: null,
    cwd: env.PLUGIN_DATA,
    hook_event_name: event,
    model: 'gpt-5.3-codex',
    permission_mode: 'default',
  };
}

function start(env, sessionId, source = 'startup') {
  return runHook('ponytail-activate.js', env, {
    ...payloadBase(env, sessionId, 'SessionStart'),
    source,
  });
}

function prompt(env, sessionId, text, turn = 'turn-1') {
  return runHook('ponytail-mode-tracker.js', env, {
    ...payloadBase(env, sessionId, 'UserPromptSubmit'),
    turn_id: turn,
    prompt: text,
  });
}

function subagent(env, sessionId, agentType = 'general-purpose') {
  return runHook('ponytail-subagent.js', env, {
    ...payloadBase(env, sessionId, 'SubagentStart'),
    turn_id: 'subagent-turn-1',
    agent_id: 'agent-1',
    agent_type: agentType,
  });
}

function outputOf(result) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const stdout = result.stdout.trim();
  return stdout ? JSON.parse(stdout) : null;
}

function contextOf(result, event) {
  const output = outputOf(result);
  if (!output?.hookSpecificOutput) return null;
  assert.equal(output.additionalContext, undefined, 'Codex context must not be top-level');
  assert.equal(output.hookSpecificOutput.hookEventName, event);
  return output.hookSpecificOutput.additionalContext || null;
}

function statePath(env, sessionId) {
  const key = crypto.createHash('sha256').update(sessionId).digest('hex');
  return path.join(env.PLUGIN_DATA, 'sessions', `${key}.json`);
}

function readState(env, sessionId) {
  return JSON.parse(fs.readFileSync(statePath(env, sessionId), 'utf8'));
}

function countBase(context) {
  return (context?.match(/^PONYTAIL BASE\b/gm) || []).length;
}

function countControls(context) {
  return (context?.match(/^PONYTAIL CONTROL\b/gm) || []).length;
}

function assertControl(context, mode) {
  assert.match(context, new RegExp(`^PONYTAIL CONTROL\\b[^\\n]*\\bmode=${mode}\\b`, 'm'));
}

function assertActivation(context, mode) {
  assert.equal(countBase(context), 1, 'activation must contain one base ruleset');
  assert.equal(countControls(context), 1, 'activation must contain one mode control');
  assertControl(context, mode);
  const base = context.match(/^PONYTAIL BASE hash=([a-f0-9]{64})$/m);
  assert.ok(base, 'activation must identify its base hash');
  assert.match(context, /This base supersedes every earlier PONYTAIL BASE/);
  assert.match(
    context,
    new RegExp(`^PONYTAIL CONTROL\\b[^\\n]*\\bbase=${base[1]}\\b`, 'm'),
    'active control must bind to the new base and exclude historical bases',
  );
}

test('Codex startup supports off, lite, full, and ultra defaults', (t) => {
  for (const mode of ['off', 'lite', 'full', 'ultra']) {
    const { env } = workspace(t, mode);
    const sessionId = `startup-${mode}`;
    const context = contextOf(start(env, sessionId), 'SessionStart');
    const state = readState(env, sessionId);

    assert.equal(state.mode, mode);
    assert.equal(state.generation, 1);
    assert.equal(state.revision, 0);
    if (mode === 'off') {
      assert.equal(context, null);
      assert.equal(state.baseHash, null);
    } else {
      assertActivation(context, mode);
      assert.ok(state.baseHash);
    }
  }

  const { env } = workspace(t, 'review');
  const reviewContext = contextOf(start(env, 'invalid-review-default'), 'SessionStart');
  assertActivation(reviewContext, 'full');
  assert.equal(readState(env, 'invalid-review-default').mode, 'full');
});

test('Codex clear resets each thread to its configured default', (t) => {
  for (const mode of ['off', 'lite', 'full', 'ultra']) {
    const { env } = workspace(t, mode);
    const sessionId = `clear-${mode}`;
    contextOf(start(env, sessionId), 'SessionStart');
    contextOf(prompt(env, sessionId, mode === 'full' ? '$ponytail lite' : '$ponytail full'), 'UserPromptSubmit');

    const beforeClear = readState(env, sessionId);
    const context = contextOf(start(env, sessionId, 'clear'), 'SessionStart');
    const cleared = readState(env, sessionId);

    assert.equal(cleared.mode, mode);
    assert.equal(cleared.generation, beforeClear.generation + 1);
    assert.equal(cleared.revision, 0);
    if (mode === 'off') assert.equal(context, null);
    else assertActivation(context, mode);
  }
});

test('$ponytail default changes future Codex threads without changing the current thread', (t) => {
  const { env } = workspace(t, 'full');
  delete env.PONYTAIL_DEFAULT_MODE;
  const currentSession = 'default-command-current';
  assertActivation(contextOf(start(env, currentSession), 'SessionStart'), 'full');
  const before = readState(env, currentSession);

  const output = outputOf(prompt(env, currentSession, '$ponytail default off'));
  assert.equal(output.systemMessage, 'PONYTAIL:FULL', 'default command reports the current thread mode');
  assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const context = output.hookSpecificOutput.additionalContext;
  assert.match(context, /PONYTAIL DEFAULT SET/);
  assert.equal(countBase(context), 0);
  assert.equal(countControls(context), 0);
  assert.deepEqual(readState(env, currentSession), before);

  const futureSession = 'default-command-future';
  assert.equal(contextOf(start(env, futureSession), 'SessionStart'), null);
  assert.equal(readState(env, futureSession).mode, 'off');
});

test('Codex default off activates late, changes mode without duplicating base, and ignores same-mode switches', (t) => {
  const { env } = workspace(t, 'off');
  const sessionId = 'late-activation';

  assert.equal(contextOf(start(env, sessionId), 'SessionStart'), null);

  const first = contextOf(prompt(env, sessionId, '$ponytail lite'), 'UserPromptSubmit');
  assertActivation(first, 'lite');
  const afterLite = readState(env, sessionId);
  assert.equal(afterLite.revision, 1);

  const changed = contextOf(prompt(env, sessionId, '$ponytail full', 'turn-2'), 'UserPromptSubmit');
  assert.equal(countBase(changed), 0, 'lite -> full must reuse the existing base');
  assert.equal(countControls(changed), 1);
  assertControl(changed, 'full');
  const afterFull = readState(env, sessionId);
  assert.equal(afterFull.revision, 2);

  const repeated = contextOf(prompt(env, sessionId, '$ponytail full', 'turn-3'), 'UserPromptSubmit');
  assert.equal(repeated, null, 'same-mode switch must add no model context');
  assert.deepEqual(readState(env, sessionId), afterFull, 'same-mode switch must not revise state');

  const namespaced = contextOf(
    prompt(env, sessionId, '$ponytail:ponytail ultra', 'turn-4'),
    'UserPromptSubmit',
  );
  assert.equal(countBase(namespaced), 0);
  assertControl(namespaced, 'ultra');
  assert.equal(readState(env, sessionId).mode, 'ultra');
});

test('Codex off and reactivation use authoritative controls and reuse a live base', (t) => {
  const { env } = workspace(t, 'full');
  const sessionId = 'off-reactivate';

  assertActivation(contextOf(start(env, sessionId), 'SessionStart'), 'full');
  const activeState = readState(env, sessionId);

  const off = contextOf(prompt(env, sessionId, '$ponytail off'), 'UserPromptSubmit');
  assert.equal(countBase(off), 0);
  assert.equal(countControls(off), 1);
  assertControl(off, 'off');
  const offState = readState(env, sessionId);
  assert.equal(offState.mode, 'off');
  assert.equal(offState.baseHash, activeState.baseHash, 'off retains the base while it remains in history');

  const active = contextOf(prompt(env, sessionId, '$ponytail ultra', 'turn-2'), 'UserPromptSubmit');
  assert.equal(countBase(active), 0, 'reactivation in the same generation must reuse the base');
  assert.equal(countControls(active), 1);
  assertControl(active, 'ultra');
  assert.equal(readState(env, sessionId).mode, 'ultra');
});

test('Codex resume, clear, and compact follow distinct lifecycle transitions', (t) => {
  const { env } = workspace(t, 'lite');
  const sessionId = 'lifecycle-sources';

  assertActivation(contextOf(start(env, sessionId), 'SessionStart'), 'lite');
  contextOf(prompt(env, sessionId, '$ponytail ultra'), 'UserPromptSubmit');
  const beforeResume = readState(env, sessionId);

  assert.equal(contextOf(start(env, sessionId, 'resume'), 'SessionStart'), null);
  assert.deepEqual(readState(env, sessionId), beforeResume, 'resume preserves valid session state');

  const compact = contextOf(start(env, sessionId, 'compact'), 'SessionStart');
  assertActivation(compact, 'ultra');
  const compacted = readState(env, sessionId);
  assert.equal(compacted.mode, 'ultra');
  assert.equal(compacted.generation, beforeResume.generation + 1);

  const cleared = contextOf(start(env, sessionId, 'clear'), 'SessionStart');
  assertActivation(cleared, 'lite');
  const clearState = readState(env, sessionId);
  assert.equal(clearState.mode, 'lite');
  assert.equal(clearState.generation, compacted.generation + 1);
  assert.equal(clearState.revision, 0);

  contextOf(prompt(env, sessionId, '$ponytail off', 'turn-off'), 'UserPromptSubmit');
  const beforeOffCompact = readState(env, sessionId);
  assert.equal(contextOf(start(env, sessionId, 'compact'), 'SessionStart'), null);
  const offCompacted = readState(env, sessionId);
  assert.equal(offCompacted.mode, 'off');
  assert.equal(offCompacted.generation, beforeOffCompact.generation + 1);
  assert.equal(offCompacted.baseHash, null);
});

test('Codex state and subagent inheritance are isolated by session ID', (t) => {
  const { env } = workspace(t, 'off');
  const sessionA = 'concurrent-session-a';
  const sessionB = 'concurrent-session-b';

  contextOf(start(env, sessionA), 'SessionStart');
  contextOf(start(env, sessionB), 'SessionStart');
  assertActivation(contextOf(prompt(env, sessionA, '$ponytail full'), 'UserPromptSubmit'), 'full');

  const subA = contextOf(subagent(env, sessionA), 'SubagentStart');
  assertActivation(subA, 'full');
  assert.equal(contextOf(subagent(env, sessionB), 'SubagentStart'), null);
  assert.equal(readState(env, sessionA).mode, 'full');
  assert.equal(readState(env, sessionB).mode, 'off');

  assertActivation(contextOf(prompt(env, sessionB, '$ponytail lite'), 'UserPromptSubmit'), 'lite');
  assert.equal(readState(env, sessionA).mode, 'full');
  assert.equal(readState(env, sessionB).mode, 'lite');

  const scopedEnv = { ...env, PONYTAIL_SUBAGENT_MATCHER: '^plan$' };
  assert.equal(contextOf(subagent(scopedEnv, sessionA, 'general-purpose'), 'SubagentStart'), null);
  assertActivation(contextOf(subagent(scopedEnv, sessionA, 'plan'), 'SubagentStart'), 'full');
});

test('Codex missing and corrupt state recover safely without using the legacy global flag', (t) => {
  const { env } = workspace(t, 'off');
  const missing = 'missing-state';
  const corrupt = 'corrupt-state';

  const missingContext = contextOf(start(env, missing, 'resume'), 'SessionStart');
  assertControl(missingContext, 'off');
  assert.equal(countBase(missingContext), 0);
  assert.equal(readState(env, missing).mode, 'off');

  fs.mkdirSync(path.dirname(statePath(env, corrupt)), { recursive: true });
  fs.writeFileSync(statePath(env, corrupt), '{not-json');
  const corruptContext = contextOf(start(env, corrupt, 'resume'), 'SessionStart');
  assertControl(corruptContext, 'off');
  assert.equal(readState(env, corrupt).mode, 'off');

  const noSession = outputOf(runHook('ponytail-mode-tracker.js', env, {
    prompt: '$ponytail full',
    hook_event_name: 'UserPromptSubmit',
  }));
  assert.equal(noSession, null);
  assert.equal(fs.existsSync(path.join(env.PLUGIN_DATA, '.ponytail-active')), false);

  const malformed = spawnSync(process.execPath, [path.join(root, 'hooks', 'ponytail-activate.js')], {
    env,
    input: '{not-json',
    encoding: 'utf8',
    timeout: 4000,
  });
  assert.equal(malformed.status, 0, malformed.stderr);
  assert.equal(malformed.stdout, '');

  for (const sessionId of ['missing-explicit-off', 'corrupt-explicit-off']) {
    if (sessionId.startsWith('corrupt')) {
      fs.mkdirSync(path.dirname(statePath(env, sessionId)), { recursive: true });
      fs.writeFileSync(statePath(env, sessionId), '{not-json');
    }
    const off = contextOf(prompt(env, sessionId, '$ponytail off'), 'UserPromptSubmit');
    assertControl(off, 'off');
    assert.equal(countBase(off), 0);
    assert.equal(readState(env, sessionId).mode, 'off');
  }
});

test('bare controller and one-shot skills are state-silent when Codex state is absent or corrupt', (t) => {
  const { env } = workspace(t, 'off');
  const missing = 'bare-missing-state';
  const missingStatus = contextOf(prompt(env, missing, '$ponytail'), 'UserPromptSubmit');
  assert.match(missingStatus, /PONYTAIL MODE ACTIVE — level: off/);
  assert.equal(countBase(missingStatus), 0);
  assert.equal(countControls(missingStatus), 0);
  assert.equal(fs.existsSync(statePath(env, missing)), false);

  const corrupt = 'bare-corrupt-state';
  fs.mkdirSync(path.dirname(statePath(env, corrupt)), { recursive: true });
  fs.writeFileSync(statePath(env, corrupt), '{not-json');
  const corruptStatus = contextOf(prompt(env, corrupt, '$ponytail'), 'UserPromptSubmit');
  assert.match(corruptStatus, /PONYTAIL MODE ACTIVE — level: off/);
  assert.equal(countBase(corruptStatus), 0);
  assert.equal(countControls(corruptStatus), 0);
  assert.equal(fs.readFileSync(statePath(env, corrupt), 'utf8'), '{not-json');

  for (const skill of ['review', 'audit', 'debt', 'gain', 'help']) {
    const sessionId = `missing-one-shot-${skill}`;
    assert.equal(outputOf(prompt(env, sessionId, `$ponytail:ponytail-${skill}`)), null);
    assert.equal(fs.existsSync(statePath(env, sessionId)), false);
  }
});

test('resume recovery outranks controls from a deleted higher-generation state', (t) => {
  const { env } = workspace(t, 'full');
  const sessionId = 'resume-recovery-authority';
  contextOf(start(env, sessionId), 'SessionStart');
  contextOf(start(env, sessionId, 'compact'), 'SessionStart');
  const beforeLoss = readState(env, sessionId);
  assert.ok(beforeLoss.generation > 1);
  fs.unlinkSync(statePath(env, sessionId));

  const recovered = contextOf(start(env, sessionId, 'resume'), 'SessionStart');
  assertActivation(recovered, 'full');
  const recoveredState = readState(env, sessionId);
  assert.ok(recoveredState.generation > beforeLoss.generation);
  assert.match(recovered, new RegExp(`^PONYTAIL CONTROL\\b[^\\n]*generation=${recoveredState.generation}\\b`, 'm'));
});

test('Codex repairs a stale active base once on an ordinary prompt', (t) => {
  const { env } = workspace(t, 'full');
  const sessionId = 'stale-base';
  contextOf(start(env, sessionId), 'SessionStart');

  const state = readState(env, sessionId);
  fs.writeFileSync(statePath(env, sessionId), JSON.stringify({ ...state, baseHash: '0'.repeat(64) }));

  const repaired = contextOf(prompt(env, sessionId, 'continue the implementation'), 'UserPromptSubmit');
  assertActivation(repaired, 'full');
  const repairedState = readState(env, sessionId);
  assert.notEqual(repairedState.baseHash, '0'.repeat(64));
  assert.equal(repairedState.mode, state.mode);
  assert.equal(repairedState.generation, state.generation);
  assert.equal(repairedState.revision, state.revision);

  assert.equal(
    contextOf(prompt(env, sessionId, 'continue again', 'turn-2'), 'UserPromptSubmit'),
    null,
    'matching base must not be repaired twice',
  );
});

test('Codex ignores interrupted temporary writes beside canonical session state', (t) => {
  const { env } = workspace(t, 'full');
  const sessionId = 'interrupted-write';
  contextOf(start(env, sessionId), 'SessionStart');
  const before = readState(env, sessionId);
  fs.writeFileSync(`${statePath(env, sessionId)}.interrupted.tmp`, '{not-json');

  assert.equal(contextOf(start(env, sessionId, 'resume'), 'SessionStart'), null);
  assert.deepEqual(readState(env, sessionId), before);

  const changed = contextOf(prompt(env, sessionId, '$ponytail lite'), 'UserPromptSubmit');
  assertControl(changed, 'lite');
  assert.equal(readState(env, sessionId).mode, 'lite');
});

test('Codex one-shot skills never mutate persistent mode', (t) => {
  const { env } = workspace(t, 'full');
  const sessionId = 'one-shot-skills';
  contextOf(start(env, sessionId), 'SessionStart');
  const before = readState(env, sessionId);

  for (const skill of ['review', 'audit', 'debt', 'gain', 'help']) {
    const command = `$ponytail:ponytail-${skill}`;
    const result = prompt(env, sessionId, command, `turn-${skill}`);
    assert.equal(contextOf(result, 'UserPromptSubmit'), null, `${command} must not inject mode context`);
    assert.deepEqual(readState(env, sessionId), before, `${command} must not change mode state`);
  }
});

test('Codex hook output keeps additionalContext under hookSpecificOutput', (t) => {
  const { env } = workspace(t, 'full');
  const output = outputOf(start(env, 'output-schema'));

  assert.equal(output.systemMessage, 'PONYTAIL:FULL');
  assert.equal(output.additionalContext, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof output.hookSpecificOutput.additionalContext, 'string');
});
