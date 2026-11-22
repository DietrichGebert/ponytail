#!/usr/bin/env node
// ponytail — UserPromptSubmit hook to track which ponytail mode is active
// Inspects user input for /ponytail commands and writes mode to flag file

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getClaudeDir, getDefaultMode, isDeactivationCommand, writeDefaultMode } = require('./ponytail-config');
const { resolveHost } = require('./ponytail-host');
const {
  clearMode,
  cursorRuleNotice,
  cursorRulePath,
  readMode,
  setMode,
  writeHookOutput,
} = require('./ponytail-runtime');
const { getPonytailInstructions } = require('./ponytail-instructions');

const host = resolveHost();
const EVENT = 'UserPromptSubmit';

let input = '';
let done = false;

function turnOff() {
  if (host.persistOffAsFlag) setMode('off');
  else clearMode();
}

function emit(mode, context) {
  writeHookOutput(EVENT, mode, context);
}

function emitModeSwitch(mode) {
  // Qoder folds the confirmation into the per-prompt ruleset (one JSON).
  if (host.foldNoticesIntoRuleset) return;
  const header = 'PONYTAIL MODE CHANGED — level: ' + mode;
  emit(mode, host.deliverRulesetOnModeSwitch
    ? header + '\n\n' + getPonytailInstructions(mode)
    : header);
}

function handleBand(parts) {
  // `/ponytail band import`: past sessions into the board, in the background, so the prompt
  // is answered right away while the transcripts are read. Detached, it outlives this hook's
  // process.exit below.
  if (parts[2] === 'import') {
    spawn(process.execPath, [path.join(__dirname, 'ponytail-band-import.js')], { detached: true, stdio: 'ignore' });
    emit(readMode() || 'off', 'PONYTAIL BAND IMPORT: past Claude Code sessions (cost, agent time, tokens) are being added to the board in the background. Open the board in a minute. Confirm in one short line.');
    return;
  }
  const flag = path.join(getClaudeDir(), '.ponytail-band');
  let hidden = false;
  try { hidden = fs.readFileSync(flag, 'utf8').trim() === 'off'; } catch (e) {}
  const show = parts[2] === 'on' ? true : parts[2] === 'off' ? false : hidden;
  if (show) {
    try { fs.unlinkSync(flag); } catch (e) {}
  } else {
    fs.mkdirSync(path.dirname(flag), { recursive: true });
    fs.writeFileSync(flag, 'off');
  }
  emit(readMode() || 'off', show
    ? 'PONYTAIL BAND ON: the band shows above the prompt again. The ponytail level is unchanged. Confirm in one short line.'
    : 'PONYTAIL BAND OFF: the band above the prompt is hidden, `/ponytail band` brings it back. The ponytail level is unchanged. Confirm in one short line.');
}

function injectQoderRuleset(modeSwitched, defaultNotice, deactivated) {
  if (!host.injectRulesEveryPrompt || deactivated) return;
  let currentMode = readMode();
  if (!currentMode) {
    // First prompt in session — initialize from config/env default
    currentMode = getDefaultMode();
    if (currentMode !== 'off') {
      try { setMode(currentMode); } catch (e) {}
    }
  }
  if (currentMode && currentMode !== 'off') {
    const header = (defaultNotice ? defaultNotice + '\n\n' : '') + (modeSwitched
      ? 'PONYTAIL MODE CHANGED — level: ' + currentMode + '\n\n'
      : '');
    emit(currentMode, header + getPonytailInstructions(currentMode));
  } else if (defaultNotice) {
    emit(currentMode, defaultNotice);
  }
}

function finish() {
  if (done) return;
  done = true;
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Cursor with the always-on rule in the workspace: no hook can change or
    // switch off a rule, so answer the command with the notice instead of
    // writing a mode the rule would contradict (#817). Ordinary prompts
    // stay silent as usual.
    if (host.respectsAlwaysOnRule && (/^[/@$]ponytail/.test(prompt) || isDeactivationCommand(prompt))) {
      const rule = cursorRulePath();
      if (rule) {
        emit(readMode() || 'off', cursorRuleNotice(rule));
        return;
      }
    }

    let modeSwitched = false;
    let deactivated = false;
    let defaultNotice = '';

    if (/^[/@$]ponytail/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      let mode = null;
      let isReportOnly = false;

      // /ponytail-review is a one-shot skill, not a session level (#736).
      // Matching it here used to setMode('review'), which latched
      // INDEPENDENT_MODES for the rest of the session.
      if (cmd === '/ponytail' || cmd === '/ponytail:ponytail') {
        // `/ponytail default <mode>` persists the default to config (survives
        // restarts). Plain switches stay session-scoped ("sticks until session
        // end"), so this is the only path that writes config. review is not a
        // valid default (#377), so only off/lite/full/ultra are accepted.
        if (arg === 'default') {
          const dmode = parts[2];
          if (dmode === 'off' || dmode === 'lite' || dmode === 'full' || dmode === 'ultra') {
            writeDefaultMode(dmode);
            defaultNotice = 'PONYTAIL DEFAULT SET — new sessions start in ' + dmode + '.';
            if (!host.foldNoticesIntoRuleset) emit(dmode, defaultNotice);
          }
          // Qoder still needs this turn's ruleset: injectQoderRuleset folds the
          // notice into it. mode stays null, so the session level is untouched.
          if (!host.foldNoticesIntoRuleset) return;
        } else if (arg === 'band' && host.supportsBand) {
          handleBand(parts);
          return;
        } else if (arg === 'lite' || arg === 'full' || arg === 'ultra' || arg === 'off') {
          mode = arg;
        } else if (arg === '') {
          // Bare /ponytail switches ponytail on: off → the default level (full if
          // the default is off too); already on → keep the level, report it (#639).
          const live = readMode();
          if (live && live !== 'off') {
            isReportOnly = true;
            mode = live;
          } else {
            mode = getDefaultMode() === 'off' ? 'full' : getDefaultMode();
          }
        }
      }

      if (isReportOnly) {
        // On Qoder the ruleset block below already reports; a second write
        // here would put two JSON objects on stdout.
        if (!host.foldNoticesIntoRuleset) {
          emit(mode, 'PONYTAIL MODE ACTIVE — level: ' + mode);
        }
      } else if (mode && mode !== 'off') {
        setMode(mode);
        modeSwitched = true;
        emitModeSwitch(mode);
      } else if (mode === 'off') {
        turnOff();
        deactivated = true;
        emit('off', 'PONYTAIL MODE OFF');
      }
    }

    if (!modeSwitched && !deactivated && isDeactivationCommand(prompt)) {
      turnOff();
      deactivated = true;
      emit('off', 'PONYTAIL MODE OFF');
    }

    // Qoder has no SessionStart event, so UserPromptSubmit does double duty:
    // activate the default mode on first prompt (if no flag exists yet), then
    // inject the ruleset on every prompt. Claude Code/Codex do this in
    // SessionStart via ponytail-activate.js; Qoder can't, so we do it here.
    injectQoderRuleset(modeSwitched, defaultNotice, deactivated);
  } catch (e) {
    // Silent fail
  }
}

process.stdin.on('data', chunk => { input += chunk; });
// Exit on 'end', not just finish(): the fallback timer below must stay ref'd
// (see #790) so it can actually fire when stdin is stuck, and a ref'd timer
// would otherwise keep the process alive for its full 1000ms on this normal
// fast path.
process.stdin.on('end', () => { finish(); process.exit(0); });

// Never hang the session. On Windows, Claude Code runs this hook through a
// PowerShell `if {}` wrapper that can swallow the piped prompt JSON, so stdin
// 'end' never fires and the hook blocks forever — freezing the session (#443).
// On error, or after a short fallback, process whatever arrived (recovering the
// mode if data came without EOF) and exit. The fallback timer MUST stay ref'd:
// on Windows a stuck ref'd stdin handle keeps the event loop alive, and an
// unref'd timer competing with it is never scheduled — so the fallback was
// dead code in exactly the #443/#790 case it exists for, and the hook hung
// until Claude Code's external 5s watchdog killed it (#790). Mirrors the
// best-effort, never-block contract the other lifecycle hooks already follow.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000);
