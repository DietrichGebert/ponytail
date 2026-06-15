#!/usr/bin/env node
// ponytail — UserPromptSubmit hook to track which ponytail mode is active
// Inspects user input for /ponytail commands and writes mode to flag file

const { getDefaultMode } = require('./ponytail-config');
const { clearMode, getMode, setMode, writeHookOutput } = require('./ponytail-runtime');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^﻿/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Match /ponytail commands
    if (/^[/@$]ponytail/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/ponytail-review' || cmd === '/ponytail:ponytail-review') {
        mode = 'review';
      } else if (cmd === '/ponytail' || cmd === '/ponytail:ponytail') {
        if (arg === 'lite') mode = 'lite';
        else if (arg === 'full') mode = 'full';
        else if (arg === 'ultra') mode = 'ultra';
        else if (arg === 'off') mode = 'off';
        else mode = getDefaultMode();
      }

      if (mode && mode !== 'off') {
        setMode(mode);
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          'PONYTAIL MODE CHANGED — level: ' + mode,
        );
        return;
      } else if (mode === 'off') {
        clearMode();
        writeHookOutput('UserPromptSubmit', 'off', 'PONYTAIL MODE OFF');
        return;
      }
    }

    // Detect deactivation
    if (/\b(stop ponytail|normal mode)\b/i.test(prompt)) {
      clearMode();
      writeHookOutput('UserPromptSubmit', 'off', 'PONYTAIL MODE OFF');
      return;
    }

    // Per-turn reminder: prevents drift when SessionStart context is compacted away
    const activeMode = getMode();
    if (activeMode && activeMode !== 'off') {
      writeHookOutput('UserPromptSubmit', activeMode, 'PONYTAIL MODE ACTIVE — level: ' + activeMode);
    }
  } catch (e) {
    // Silent fail
  }
});
