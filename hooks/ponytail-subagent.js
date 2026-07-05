#!/usr/bin/env node
// ponytail — Claude Code SubagentStart hook
//
// SessionStart context is parent-thread only and never reaches subagents, so
// without this every Task-spawned agent runs ponytail-unaware (issue #252).
// When ponytail mode is active, inject the same ruleset into each subagent.
//
// Consumers can opt in to scoping the injection to specific agent types
// (issue #506) via PONYTAIL_SUBAGENT_AGENTS or the config file's
// subagentAgents array; unconfigured means inject into every subagent,
// matching prior behavior.

const { getPonytailInstructions } = require('./ponytail-instructions');
const { getSubagentAgents } = require('./ponytail-config');
const { readMode, writeHookOutput } = require('./ponytail-runtime');

const mode = readMode();

// Absent flag or off → ponytail isn't active; inject nothing.
if (!mode || mode === 'off') {
  process.exit(0);
}

let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  const allowed = getSubagentAgents();
  if (allowed) {
    let agentType = null;
    try {
      // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
      agentType = JSON.parse(input.replace(/^\uFEFF/, '')).agent_type;
    } catch (e) {
      // No or unparseable payload — the platform didn't send agent_type.
    }
    // Skip only on a positive mismatch; a missing agent_type keeps the
    // issue-#252 behavior of injecting everywhere.
    if (
      typeof agentType === 'string' &&
      !allowed.includes(agentType.trim().toLowerCase())
    ) {
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
process.stdin.on('end', finish);

// Never hang the session (#443): same best-effort stdin contract as the mode
// tracker — on error, or after a short fallback, act on whatever arrived.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
