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
const { readHookInput, readMode, sessionIdFrom, writeHookOutput } = require('./ponytail-runtime');

// A bad regex must never crash the hook; treat it as "no matcher" and inject.
let matcherRe = null;
try {
  if (process.env.PONYTAIL_SUBAGENT_MATCHER) {
    matcherRe = new RegExp(process.env.PONYTAIL_SUBAGENT_MATCHER, 'i');
  }
} catch (e) {
  matcherRe = null;
}

// The payload carries the parent session's id, which picks that session's mode
// (#662), and agent_type for the matcher. A payload that never arrives (#443)
// costs the 1s fallback and reads the legacy flag, as before session keying.
readHookInput((data) => {
  const mode = readMode(sessionIdFrom(data));

  // Absent flag or off → ponytail isn't active; inject nothing.
  if (!mode || mode === 'off') process.exit(0);

  // Skip only on a definite mismatch. Missing/unparseable agent_type, a stdin
  // error, or the timeout all fail open (inject), so scoping never silently
  // drops the persona.
  const agentType = String((data && data.agent_type) || '').trim();
  if (matcherRe && agentType && !matcherRe.test(agentType)) process.exit(0);

  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
    // Silent fail — a stdout error at hook exit must not surface as a hook failure.
  }
});
