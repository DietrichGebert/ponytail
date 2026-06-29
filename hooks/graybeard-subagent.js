#!/usr/bin/env node
// graybeard — Claude Code SubagentStart hook
//
// SessionStart context is parent-thread only and never reaches subagents, so
// without this every Task-spawned agent runs graybeard-unaware (issue #252).
// When graybeard mode is active, inject the same ruleset into each subagent.

const { getGraybeardInstructions } = require('./graybeard-instructions');
const { readMode, writeHookOutput } = require('./graybeard-runtime');

const mode = readMode();

// Absent flag or off → graybeard isn't active; inject nothing.
if (!mode || mode === 'off') {
  process.exit(0);
}

try {
  writeHookOutput('SubagentStart', mode, getGraybeardInstructions(mode));
} catch (e) {
  // Silent fail — a stdout error at hook exit must not surface as a hook failure.
}
