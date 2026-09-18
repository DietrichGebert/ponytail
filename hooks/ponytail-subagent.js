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

let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  let data = null;
  let agentType = '';
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    data = JSON.parse(input.replace(/^\uFEFF/, ''));
    agentType = String(data.agent_type || '').trim();
  } catch (e) {
    // Unparseable payload — fall through and inject to be safe.
  }

  const mode = readMode(data);
  if (!mode || mode === 'off') return;

  let matcherRe = null;
  try {
    if (process.env.PONYTAIL_SUBAGENT_MATCHER) {
      matcherRe = new RegExp(process.env.PONYTAIL_SUBAGENT_MATCHER, 'i');
    }
  } catch (e) {
    matcherRe = null;
  }

  // No matcher (env unset or bad regex) → inject into every subagent, as
  // before; only a definite mismatch against a live regex skips the inject.
  if (matcherRe && agentType && !matcherRe.test(agentType)) return;
  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
    // Silent fail — a stdout error at hook exit must not surface as a hook failure.
  }
}

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);
// Never block the session (#443): recover on stdin error or a short fallback.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
