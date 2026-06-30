#!/usr/bin/env node
// gavel — UserPromptSubmit hook to track which gavel mode is active
// Inspects user input for /gavel commands and writes mode to flag file

const { getDefaultMode } = require('./gavel-config');
const { clearMode, setMode, writeHookOutput } = require('./gavel-runtime');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Match /gavel commands
    if (/^[/@$]gavel/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/gavel-review' || cmd === '/gavel:gavel-review') {
        mode = 'review';
      } else if (cmd === '/gavel' || cmd === '/gavel:gavel') {
        if (arg === 'lite') mode = 'lite';
        else if (arg === 'full') mode = 'full';
        else if (arg === 'strict') mode = 'strict';
        else if (arg === 'off') mode = 'off';
        else mode = getDefaultMode();
      }

      if (mode && mode !== 'off') {
        setMode(mode);
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          'GAVEL MODE CHANGED — level: ' + mode,
        );
      } else if (mode === 'off') {
        clearMode();
        writeHookOutput('UserPromptSubmit', 'off', 'GAVEL MODE OFF');
      }
    }

    // Detect deactivation: "stop gavel" / "normal mode"
    if (/^(stop\s+gavel|normal\s+mode)/.test(prompt)) {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'GAVEL MODE OFF');
    }
  } catch (e) {
    // Silent fail
  }
});
