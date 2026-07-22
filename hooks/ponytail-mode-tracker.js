#!/usr/bin/env node
// ponytail — UserPromptSubmit hook to track which ponytail mode is active

const { getDefaultMode, isDeactivationCommand, writeDefaultMode } = require('./ponytail-config');
const {
  normalizeSessionId,
  readSessionState,
  repairSession,
  transitionSessionMode,
} = require('./ponytail-codex-session');
const { getPonytailInstructions } = require('./ponytail-instructions');
const { readHookPayload } = require('./ponytail-stdin');
const {
  clearMode,
  isCodex,
  isQoder,
  readMode,
  setMode,
  writeHookOutput,
} = require('./ponytail-runtime');

readHookPayload((data) => {
  if (!data) return;
  const prompt = String(data.prompt || '').trim().toLowerCase();
  if (isCodex) handleCodex(data, prompt);
  else handleLegacy(prompt);
});

function normalizedCommand(prompt) {
  const parts = prompt.split(/\s+/);
  return {
    arg: parts[1] || '',
    command: parts[0].replace(/^[@$]/, '/'),
    parts,
  };
}

function isControllerCommand(command) {
  return command === '/ponytail' || command === '/ponytail:ponytail';
}

function isOneShotCommand(command) {
  return command === '/ponytail-review' ||
    command === '/ponytail:ponytail-review' ||
    command === '/ponytail-audit' ||
    command === '/ponytail:ponytail-audit' ||
    command === '/ponytail-debt' ||
    command === '/ponytail:ponytail-debt' ||
    command === '/ponytail-gain' ||
    command === '/ponytail:ponytail-gain' ||
    command === '/ponytail-help' ||
    command === '/ponytail:ponytail-help';
}

function emitRepair(sessionId, options) {
  const result = repairSession(sessionId, getDefaultMode(), options);
  if (result && result.context) {
    writeHookOutput('UserPromptSubmit', result.mode, result.context);
  }
  return result;
}

function handleCodex(data, prompt) {
  if (!normalizeSessionId(data.session_id)) return;
  const parsed = normalizedCommand(prompt);

  if (isControllerCommand(parsed.command)) {
    if (parsed.arg === 'default') {
      const currentMode = readSessionState(data.session_id)?.mode || getDefaultMode();
      const configured = writeDefaultMode(parsed.parts[2]);
      if (configured) {
        writeHookOutput(
          'UserPromptSubmit',
          currentMode,
          'PONYTAIL DEFAULT SET — new sessions start in ' + configured + '.',
        );
      }
      return;
    }

    if (['off', 'lite', 'full', 'ultra'].includes(parsed.arg)) {
      const result = transitionSessionMode(data.session_id, parsed.arg, getDefaultMode());
      if (result) writeHookOutput('UserPromptSubmit', result.mode, result.context);
      return;
    }

    const mode = readSessionState(data.session_id)?.mode || getDefaultMode();
    writeHookOutput(
      'UserPromptSubmit',
      mode,
      'PONYTAIL MODE ACTIVE — level: ' + mode,
    );
    return;
  }

  // One-shot skills carry their own instructions and never become session mode.
  if (isOneShotCommand(parsed.command)) {
    emitRepair(data.session_id, { initialize: false });
    return;
  }

  if (isDeactivationCommand(prompt)) {
    const result = transitionSessionMode(data.session_id, 'off', getDefaultMode());
    if (result) writeHookOutput('UserPromptSubmit', result.mode, result.context);
    return;
  }

  emitRepair(data.session_id);
}

function handleLegacy(prompt) {
  // Match /ponytail commands
  let modeSwitched = false;
  let deactivated = false;
  if (/^[/@$]ponytail/.test(prompt)) {
    const { arg, command: cmd, parts } = normalizedCommand(prompt);

    let mode = null;
    let isReportOnly = false;

    if (cmd === '/ponytail-review' || cmd === '/ponytail:ponytail-review') {
      mode = 'review';
    } else if (isControllerCommand(cmd)) {
      // `/ponytail default <mode>` persists the default to config (survives
      // restarts). Plain switches stay session-scoped ("sticks until session
      // end"), so this is the only path that writes config. review is not a
      // valid default (#377), so only off/lite/full/ultra are accepted.
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
      // ponytail: Qoder needs the full ruleset every turn, so when a mode
      // switch happens we fold the confirmation into the ruleset output
      // below (one JSON on stdout) instead of emitting two separate writes.
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

  // Detect deactivation
  if (!modeSwitched && !deactivated && isDeactivationCommand(prompt)) {
    clearMode();
    deactivated = true;
    writeHookOutput('UserPromptSubmit', 'off', 'PONYTAIL MODE OFF');
  }

  // Qoder has no SessionStart event, so UserPromptSubmit does double duty:
  // activate the default mode on first prompt (if no flag exists yet), then
  // inject the ruleset on every prompt. Claude Code/Codex do this in
  // SessionStart via ponytail-activate.js; Qoder can't, so we do it here.
  // Skip when deactivated — user just turned ponytail off.
  if (isQoder && !deactivated) {
    let currentMode = readMode();
    if (!currentMode) {
      // First prompt in session — initialize from config/env default
      currentMode = getDefaultMode();
      if (currentMode !== 'off') {
        try { setMode(currentMode); } catch (e) {}
      }
    }
    if (currentMode && currentMode !== 'off') {
      // ponytail: one JSON per invocation — mode-switch confirmation is
      // folded into the ruleset header so Qoder gets both in one write.
      const header = modeSwitched
        ? 'PONYTAIL MODE CHANGED — level: ' + currentMode + '\n\n'
        : '';
      writeHookOutput('UserPromptSubmit', currentMode, header + getPonytailInstructions(currentMode));
    }
  }
}
