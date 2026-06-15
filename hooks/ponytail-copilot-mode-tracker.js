#!/usr/bin/env node
// ponytail — Copilot userPromptSubmitted hook.
// Tracks mode switches only; Copilot ignores output on this hook.

const { getDefaultMode } = require('./ponytail-config');
const { clearMode, setMode } = require('./ponytail-runtime');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (typeof data.prompt === 'string' ? data.prompt : '').trim().toLowerCase();

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
      } else if (mode === 'off') {
        clearMode();
      }
    }

    if (/\b(stop ponytail|normal mode)\b/i.test(prompt)) {
      clearMode();
    }
  } catch (e) {
    // Silent fail
  }

  process.stdout.write('{}');
});
