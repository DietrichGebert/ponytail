#!/usr/bin/env node
// ponytail — Claude Code SubagentStart hook
//
// SessionStart context is parent-thread only and never reaches subagents, so
// without this every Task-spawned agent runs ponytail-unaware (issue #252).
// When ponytail mode is active, inject the same ruleset into each subagent.
//
// Scoping: by default injects into all subagents. To limit to specific agent
// types, set PONYTAIL_SUBAGENT_MATCHER to a regex (e.g. "explore|general").
// The hook reads agent_type from stdin and skips injection when it doesn't
// match. This is opt-in to preserve backward compatibility (#506).

const { getPonytailInstructions } = require('./ponytail-instructions');
const { readMode, writeHookOutput } = require('./ponytail-runtime');

const mode = readMode();

// Absent flag or off → ponytail isn't active; inject nothing.
if (!mode || mode === 'off') {
  process.exit(0);
}

// ponytail: opt-in scoping via env var. Off by default = all subagents.
// Set PONYTAIL_SUBAGENT_MATCHER to a regex matching the agent types to inject.
// Upgrade path: if many users set this, promote to config.json.
const matcher = process.env.PONYTAIL_SUBAGENT_MATCHER;
let matcherRe = null;
try {
  if (matcher) matcherRe = new RegExp(matcher, 'i');
} catch (_) {
  // Invalid regex must not crash the hook — fall back to injecting everywhere.
}

function inject() {
  try {
    writeHookOutput('SubagentStart', mode, getPonytailInstructions(mode));
  } catch (e) {
    // Silent fail — a stdout error at hook exit must not surface as a hook failure.
  }
}

// No matcher: keep the original synchronous, stdin-independent behavior. On
// Windows the PowerShell `if {}` wrapper can swallow stdin so 'end' never fires
// (#443), so the default path must not depend on reading stdin.
if (!matcherRe) {
  inject();
  process.exit(0);
}

// Matcher set: read agent_type from stdin, skip injection only on a definite
// non-match. Fail OPEN (inject) on unparseable input, stdin error, or timeout.
let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const agentType = (data.agent_type || '').trim();
    if (agentType && !matcherRe.test(agentType)) process.exit(0);
  } catch (_) {
    // Can't parse input or missing agent_type — inject to be safe.
  }
  inject();
}

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);
// Mirror mode-tracker's never-block contract: recover on error/timeout too.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
