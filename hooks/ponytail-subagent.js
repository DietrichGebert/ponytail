#!/usr/bin/env node
// ponytail — Claude Code SubagentStart hook
//
// SessionStart context is parent-thread only and never reaches subagents, so
// without this every Task-spawned agent runs ponytail-unaware (issue #252).
// When ponytail mode is active, inject the same ruleset into each subagent.
//
// Scoping (opt-in, issue #506): set PONYTAIL_SUBAGENT_MATCHER to a regex and
// the ruleset is injected only into subagents whose agent_type matches. The
// regex is unanchored and case-insensitive — "explore|general" matches either,
// "^general$" is exact. Unset means inject into every subagent, as before.

const { getPonytailInstructions } = require('./ponytail-instructions');
const { readMode, writeHookOutput } = require('./ponytail-runtime');
const vm = require('vm');

// A bad regex must never crash the hook; treat it as "no matcher" and inject.
let matcherRe = null;
try {
  if (process.env.PONYTAIL_SUBAGENT_MATCHER) {
    matcherRe = new RegExp(process.env.PONYTAIL_SUBAGENT_MATCHER, 'i');
  }
} catch (e) {
  matcherRe = null;
}

// Read session_id (and agent_type when a matcher is set) from stdin. Empty or
// unparseable stdin falls back to the project/shared mode and fails open on
// matcher checks (#443, #1528).
let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  let data = {};
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const parsed = JSON.parse(input.replace(/^\uFEFF/, ''));
    if (parsed && typeof parsed === 'object') data = parsed;
  } catch (e) {
    // Unparseable payload — fall through with empty data.
  }

  const sessionId = typeof data.session_id === 'string' ? data.session_id.trim() : '';
  const mode = readMode(sessionId);

  // Absent flag or off → ponytail isn't active; inject nothing.
  if (!mode || mode === 'off') {
    return;
  }

  if (matcherRe) {
    const agentType = String(data.agent_type || '').trim();
    // .test() is synchronous, so a backtracking-heavy matcher like (a+)+$ would
    // block the event loop and the fallback timer below could never fire (#658).
    // Run it under a vm timeout; a timeout fails open like every other doubt.
    let matches = true;
    try {
      if (agentType) {
        matches = vm.runInNewContext('re.test(s)', { re: matcherRe, s: agentType }, { timeout: 100 });
      }
    } catch (e) {
      matches = true;
    }
    if (!matches) {
      return;
    }
  }

  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
    // Silent fail — a stdout error at hook exit must not surface as a hook failure.
  }
}

process.stdin.on('data', chunk => { input += chunk; });
// Exit on 'end' (not just finish()) so the ref'd fallback timer below can't
// add its full 1000ms to the normal fast path.
process.stdin.on('end', () => { finish(); process.exit(0); });
// Never block the session (#443): recover on stdin error or a short fallback.
// The fallback stays ref'd: on Windows a stuck ref'd stdin keeps the loop
// alive and an unref'd timer is never scheduled, so the hook hung to the
// external watchdog instead of exiting at 1s (#790).
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000);
