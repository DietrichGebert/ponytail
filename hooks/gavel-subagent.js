#!/usr/bin/env node
// gavel — SubagentStart hook
//
// Injects gavel QA rules into subagent context so they enforce
// the Test Constitution even in delegated work.

const { getDefaultMode } = require('./gavel-config');
const { getGavelInstructions } = require('./gavel-instructions');
const { isCodex, isCopilot, writeHookOutput } = require('./gavel-runtime');

const mode = getDefaultMode();

if (mode === 'off') {
  const hookOutput = (isCodex || isCopilot) ? '' : 'OK';
  writeHookOutput('SubagentStart', 'off', hookOutput);
  process.exit(0);
}

const output = getGavelInstructions(mode);

try {
  writeHookOutput('SubagentStart', mode, output);
} catch (e) {}
