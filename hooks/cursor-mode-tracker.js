#!/usr/bin/env node
// Cursor beforeSubmitPrompt hook: update Ponytail mode without injecting context.
const { getDefaultMode, isDeactivationCommand } = require('./ponytail-config');
const { clearMode, setMode } = require('./ponytail-runtime');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

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

      if (mode === 'off') clearMode();
      else if (mode) setMode(mode);
    }

    if (isDeactivationCommand(prompt)) clearMode();
  } catch (e) {
    // Fail open: prompt submission should not depend on mode tracking.
  }

  process.stdout.write(JSON.stringify({ continue: true }));
});
