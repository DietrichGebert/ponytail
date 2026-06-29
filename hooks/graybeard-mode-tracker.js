#!/usr/bin/env node
// graybeard — UserPromptSubmit hook to track which graybeard mode is active
// Inspects user input for /graybeard commands and writes mode to flag file

const { getDefaultMode, isDeactivationCommand } = require('./graybeard-config');
const { clearMode, setMode, writeHookOutput } = require('./graybeard-runtime');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Match /graybeard commands
    if (/^[/@$]graybeard/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/graybeard-review' || cmd === '/graybeard:graybeard-review') {
        mode = 'review';
      } else if (cmd === '/graybeard' || cmd === '/graybeard:graybeard') {
        if (arg === 'advisory') mode = 'advisory';
        else if (arg === 'balanced') mode = 'balanced';
        else if (arg === 'strict') mode = 'strict';
        else if (arg === 'off') mode = 'off';
        else mode = getDefaultMode();
      }

      if (mode && mode !== 'off') {
        setMode(mode);
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          'GRAYBEARD MODE CHANGED — level: ' + mode,
        );
      } else if (mode === 'off') {
        clearMode();
        writeHookOutput('UserPromptSubmit', 'off', 'GRAYBEARD MODE OFF');
      }
    }

    // Detect deactivation
    if (isDeactivationCommand(prompt)) {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'GRAYBEARD MODE OFF');
    }
  } catch (e) {
    // Silent fail
  }
});
