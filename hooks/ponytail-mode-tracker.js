#!/usr/bin/env node
// UserPromptSubmit hook. Reads /ponytail switches from stdin via consumeStdin.

const { getDefaultMode, isDeactivationCommand, writeDefaultMode } = require('./ponytail-config');
const { clearMode, isQoder, readMode, setMode, writeHookOutput } = require('./ponytail-runtime');
const { getPonytailInstructions } = require('./ponytail-instructions');
const { consumeStdin } = require('./ponytail-stdin');

function finish(input) {
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    let modeSwitched = false;
    let deactivated = false;
    if (/^[/@$]ponytail/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;
      let isReportOnly = false;

      if (cmd === '/ponytail-review' || cmd === '/ponytail:ponytail-review') {
        mode = 'review';
      } else if (cmd === '/ponytail' || cmd === '/ponytail:ponytail') {
        if (arg === 'default') {
          const dmode = parts[2];
          if (dmode === 'off' || dmode === 'lite' || dmode === 'full' || dmode === 'ultra') {
            writeDefaultMode(dmode);
            writeHookOutput('UserPromptSubmit', dmode, 'PONYTAIL DEFAULT SET — new sessions start in ' + dmode + '.');
          }
          return;
        }
        if (arg === 'lite') mode = 'lite';
        else if (arg === 'full') mode = 'full';
        else if (arg === 'ultra') mode = 'ultra';
        else if (arg === 'off') mode = 'off';
        else if (arg === '') {
          isReportOnly = true;
          mode = readMode() || getDefaultMode();
        } else {
          mode = getDefaultMode();
        }
      }

      if (isReportOnly) {
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          'PONYTAIL MODE ACTIVE — level: ' + mode,
        );
      } else if (mode && mode !== 'off') {
        setMode(mode);
        modeSwitched = true;
        if (!isQoder) {
          writeHookOutput(
            'UserPromptSubmit',
            mode,
            'PONYTAIL MODE CHANGED — level: ' + mode,
          );
        }
      } else if (mode === 'off') {
        clearMode();
        deactivated = true;
        writeHookOutput('UserPromptSubmit', 'off', 'PONYTAIL MODE OFF');
      }
    }

    if (!modeSwitched && !deactivated && isDeactivationCommand(prompt)) {
      clearMode();
      deactivated = true;
      writeHookOutput('UserPromptSubmit', 'off', 'PONYTAIL MODE OFF');
    }

    if (isQoder && !deactivated) {
      let currentMode = readMode();
      if (!currentMode) {
        currentMode = getDefaultMode();
        if (currentMode !== 'off') {
          try { setMode(currentMode); } catch (e) {}
        }
      }
      if (currentMode && currentMode !== 'off') {
        const header = modeSwitched
          ? 'PONYTAIL MODE CHANGED — level: ' + currentMode + '\n\n'
          : '';
        writeHookOutput('UserPromptSubmit', currentMode, header + getPonytailInstructions(currentMode));
      }
    }
  } catch (e) {
  }
}

consumeStdin(finish);
