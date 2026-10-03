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
//
// The payload also carries session_id, read below so the injected level is the
// parent session's own mode rather than whichever sibling session in the same
// repo wrote the project/shared flag last (#992).

const { getPonytailInstructions } = require('./ponytail-instructions');
const { readMode, writeHookOutput } = require('./ponytail-runtime');
const vm = require('vm');

function inject(mode) {
  // Absent flag or off → ponytail isn't active for this session; inject nothing.
  if (!mode || mode === 'off') {
    process.exit(0);
  }
  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
    // Silent fail — a stdout error at hook exit must not surface as a hook failure.
  }
}

// A bad regex must never crash the hook; treat it as "no matcher" and inject.
let matcherRe = null;
try {
  if (process.env.PONYTAIL_SUBAGENT_MATCHER) {
    matcherRe = new RegExp(process.env.PONYTAIL_SUBAGENT_MATCHER, 'i');
  }
} catch (e) {
  matcherRe = null;
}

// Always read the payload for session_id, and (when scoping is on) agent_type.
// Missing/unparseable fields, a stdin error, or the timeout all fail open
// (inject with no session scoping, matcher matches), so this never silently
// drops the persona or the level.
let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  let sessionId;
  let agentType = '';
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^﻿/, ''));
    sessionId = data.session_id;
    agentType = String(data.agent_type || '').trim();
  } catch (e) {
    // Unparseable/empty payload — fall through with no session scoping.
  }

  if (matcherRe) {
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
      process.exit(0);
    }
  }

  inject(readMode(sessionId));
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
