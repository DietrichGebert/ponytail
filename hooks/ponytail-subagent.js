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
const { getSessionId, readHookPayload, readMode, writeHookOutput } = require('./ponytail-runtime');

function inject(mode) {
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

// The hook payload carries the parent session id as well as agent_type. Read it
// with the same bounded fallback used by SessionStart, so subagents inherit only
// their own parent's mode and malformed or missing ids cannot leak another
// session's state.
function finish(data) {
  const mode = readMode(getSessionId(data));
  if (!mode || mode === 'off') return;
  const agentType = String(data.agent_type || '').trim();
  if (matcherRe && agentType && !matcherRe.test(agentType)) {
    return;
  }
  inject(mode);
}

readHookPayload(finish);
