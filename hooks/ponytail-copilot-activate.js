#!/usr/bin/env node
// ponytail — Copilot sessionStart hook.

const { getDefaultMode } = require('./ponytail-config');
const { getPonytailInstructions } = require('./ponytail-instructions');
const { clearMode, setMode } = require('./ponytail-runtime');

const output = {};

try {
  const mode = getDefaultMode();
  if (mode === 'off') {
    clearMode();
  } else {
    try {
      setMode(mode);
    } catch (e) {
      // Silent fail -- mode file is best-effort, don't block the hook
    }
    output.additionalContext = getPonytailInstructions(mode);
  }
} catch (e) {
  // Silent fail
}

process.stdout.write(JSON.stringify(output));
