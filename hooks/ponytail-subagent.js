#!/usr/bin/env node
// ponytail — subagent-start activation hook
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
const { getSubagentActivation } = require('./ponytail-codex-session');
const { readHookPayload } = require('./ponytail-stdin');
const { isCodex, readMode, writeHookOutput } = require('./ponytail-runtime');

function inject(mode, context) {
  try {
    writeHookOutput('SubagentStart', mode, context);
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

if (isCodex) {
  readHookPayload((payload) => {
    if (!payload) return;
    const agentType = String(payload.agent_type || '').trim();
    if (matcherRe && agentType && !matcherRe.test(agentType)) return;
    const activation = getSubagentActivation(payload.session_id);
    if (activation) inject(activation.mode, activation.context);
  });
} else {
  activateLegacy();
}

function activateLegacy() {
  const mode = readMode();

  // Absent flag or off → ponytail isn't active; inject nothing.
  if (!mode || mode === 'off') return;

  // No matcher → keep the original synchronous, stdin-independent path. On Windows
  // the PowerShell `if {}` wrapper can swallow the piped JSON so stdin 'end' never
  // fires (#443); the default path must not wait on stdin or it would stall every
  // subagent spawn.
  if (!matcherRe) {
    inject(mode, getPonytailInstructions(mode));
    return;
  }

  // Matcher set → skip only on a definite mismatch. Unparseable input fails
  // open for legacy hosts, preserving the original subagent behavior.
  readHookPayload((payload) => {
    const agentType = payload ? String(payload.agent_type || '').trim() : '';
    if (agentType && !matcherRe.test(agentType)) return;
    inject(mode, getPonytailInstructions(mode));
  });
}
