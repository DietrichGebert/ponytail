#!/usr/bin/env node
// ponytail — spend firewall hook (UserPromptSubmit + PreToolUse)
//
// Meters what the session has actually spent, from the transcript the agent is
// already writing, and stops it at a budget the user set. Two checkpoints,
// because a runaway burns money at two different rates:
//
//   UserPromptSubmit — cheapest possible stop: the turn never starts.
//   PreToolUse       — catches the loop that runs away *inside* one turn, which
//                      is the case that actually empties a budget.
//
// Off unless a limit is configured, and fail-open everywhere: a guard that
// wedges a session over its own bug is worse than the bill it prevents.
//
// PreToolUse runs before every tool call, so the disabled path is the hot path.
// Nothing is required at module load — the no-limit case reads one small config
// file and exits, which keeps it within a few ms of bare `node -e 0`.

const TIER_RANK = { ok: 0, warn: 1, block: 2 };

let input = '';
let done = false;

// Advisory output, in whatever shape the host reads. The mode argument only
// feeds Codex's status line, so it carries the session's real ponytail level —
// passing something like 'spend' there would overwrite the level indicator.
function emit(event, text) {
  const { readMode, writeHookOutput } = require('./ponytail-runtime');
  writeHookOutput(event, readMode() || 'off', text);
}

// Only native Claude Code is known to honour a hook's deny decision on both of
// these events. Elsewhere the same message still goes out as advisory context —
// the agent is told to stop, it just isn't forced to.
function deny(event, reason) {
  const { isCodex, isCopilot, isQoder } = require('./ponytail-runtime');
  if (isCodex || isCopilot || isQoder) return emit(event, reason);

  if (event === 'PreToolUse') {
    return process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
  }
  process.stdout.write(JSON.stringify({ decision: 'deny', reason, systemMessage: reason }));
}

// A warning is worth saying once per tier, not once per tool call. The ledger
// remembers how far the user has already been told.
function notifyOnce(ledger, sessionId, tier, event, message) {
  if (TIER_RANK[tier] <= TIER_RANK[ledger.notifiedTier || 'ok']) return;
  ledger.notifiedTier = tier;
  require('./spend/ledger').save(sessionId, ledger);
  emit(event, message);
}

function handleCommand(command, sessionId, transcriptPath, config) {
  const { applySpendCommand } = require('./spend/commands');
  if (command.action !== 'status') {
    return emit('UserPromptSubmit', applySpendCommand(command, sessionId));
  }
  // Status is the one command that needs a fresh read: it is what someone types
  // to find out where they stand, so a stale number defeats the point.
  const { evaluate, renderStatus } = require('./spend/policy');
  const ledger = require('./spend/meter').meter(sessionId, transcriptPath, config);
  emit('UserPromptSubmit', renderStatus(ledger, config, evaluate(ledger.costUsd, config)));
}

function finish() {
  if (done) return;
  done = true;
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const event = data.hook_event_name === 'PreToolUse' ? 'PreToolUse' : 'UserPromptSubmit';
    const sessionId = data.session_id;
    const transcriptPath = data.transcript_path;

    const policy = require('./spend/policy');
    const config = policy.getSpendConfig();

    // Commands are answered before the budget gate, on purpose: raising the
    // limit or clearing the counter has to stay reachable from inside a blocked
    // session, or the only way out is to restart the agent.
    if (event === 'UserPromptSubmit') {
      const command = require('./spend/commands').parseSpendCommand(data.prompt);
      if (command) return handleCommand(command, sessionId, transcriptPath, config);
    }

    // No budget, nothing to enforce — and no transcript read on the hot path
    // for the users who never asked for this.
    if (!config.enabled) return;

    const ledger = require('./spend/meter').meter(sessionId, transcriptPath, config);
    const decision = policy.evaluate(ledger.costUsd, config);

    if (decision.tier === 'block') return deny(event, policy.renderBlock(ledger, config, decision));
    if (decision.tier === 'warn') {
      notifyOnce(ledger, sessionId, 'warn', event, policy.renderWarning(ledger, config, decision));
    }
  } catch (e) {
    // Fail open. A hook that can't parse its own input must not be the reason a
    // session stops working.
  }
}

process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', finish);

// Same never-hang contract the other lifecycle hooks follow: on Windows the
// PowerShell wrapper can swallow the piped JSON so 'end' never fires (#443).
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
