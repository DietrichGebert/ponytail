#!/usr/bin/env node
// gavel — SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.gavel-active
//   2. Emits gavel QA ruleset as hidden SessionStart context

const fs = require('fs');
const path = require('path');
const { getDefaultMode } = require('./gavel-config');
const { getGavelInstructions } = require('./gavel-instructions');
const {
  clearMode,
  isCodex,
  isCopilot,
  setMode,
  writeHookOutput,
} = require('./gavel-runtime');

const mode = getDefaultMode();

// "off" mode — skip activation
if (mode === 'off') {
  clearMode();
  const hookOutput = (isCodex || isCopilot) ? '' : 'OK';
  writeHookOutput('SessionStart', 'off', hookOutput);
  process.exit(0);
}

// 1. Write flag file
try {
  setMode(mode);
} catch (e) {
  // Silent fail
}

// 2. Emit the gavel QA ruleset
let output = getGavelInstructions(mode);

try {
  writeHookOutput('SessionStart', mode, output);
} catch (e) {
  // Silent fail — stdout closed/EPIPE must not surface as hook failure
}
