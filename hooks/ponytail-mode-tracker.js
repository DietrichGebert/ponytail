#!/usr/bin/env node
// ponytail — UserPromptSubmit hook to track which ponytail mode is active
// Inspects user input for /ponytail commands and writes mode to flag file

const { getDefaultMode, isDeactivationCommand, writeDefaultMode } = require('./ponytail-config');
const {
  clearMode,
  cursorRuleNotice,
  cursorRulePath,
  isCursor,
  isQoder,
  pruneStaleSessionState,
  readMode,
  setMode,
  touchSession,
  useSession,
  writeHookOutput,
} = require('./ponytail-runtime');

const LEVELS = ['lite', 'full', 'ultra', 'off'];
const DEFAULT_LEVELS = ['off', 'lite', 'full', 'ultra'];
const { getPonytailInstructions } = require('./ponytail-instructions');

let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;
  try {
    // Strip UTF-8 BOM some shells prepend when piping (breaks JSON.parse)
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    // State is per session when the host names one; this prompt's session is now the most
    // recently active, which is what the subagent hook falls back to.
    useSession(data);
    touchSession();
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Cursor with the always-on rule in the workspace: no hook can change or
    // switch off a rule, so answer the command with the notice instead of
    // writing a mode the rule would contradict (#817). Ordinary prompts
    // stay silent as usual.
    if (isCursor && (/^[/@$]ponytail/.test(prompt) || isDeactivationCommand(prompt))) {
      const rule = cursorRulePath();
      if (rule) {
        writeHookOutput('UserPromptSubmit', readMode() || 'off', cursorRuleNotice(rule));
        return;
      }
    }

    // Match /ponytail commands
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
        // `/ponytail default <mode>` persists the default to config (survives
        // restarts). Plain switches stay session-scoped ("sticks until session
        // end"), so this is the only path that writes config. review is not a
        // valid default (#377), so only off/lite/full/ultra are accepted.
        if (arg === 'default') {
          const dmode = parts[2];
          if (DEFAULT_LEVELS.includes(dmode)) {
            writeDefaultMode(dmode);
            writeHookOutput('UserPromptSubmit', dmode, 'PONYTAIL DEFAULT SET — new sessions start in ' + dmode + '.');
          } else {
            // Silence here used to look like success; nothing was written.
            writeHookOutput('UserPromptSubmit', readMode() || getDefaultMode(),
              'PONYTAIL DEFAULT NOT CHANGED — ' + (dmode ? "'" + dmode + "' is not a level" : 'no level given') +
              '. Use: /ponytail default off|lite|full|ultra.');
          }
          return; // don't fall through to the session-mode switch
        }
        if (LEVELS.includes(arg)) {
          mode = arg;
        } else if (arg === '') {
          isReportOnly = true;
          // Every host but Qoder writes the flag at session start, so no flag
          // means ponytail is off there. Qoder writes it on the first prompt,
          // so there no flag means "not started yet" and the default applies.
          mode = readMode() || (isQoder ? getDefaultMode() : 'off');
        } else {
          // A typo such as "lit" used to switch to the default level and report
          // success. Leave the mode alone and say what was expected.
          const current = readMode() || getDefaultMode();
          writeHookOutput('UserPromptSubmit', current,
            "PONYTAIL MODE NOT CHANGED — '" + arg + "' is not a level. Use: /ponytail lite|full|ultra|off. " +
            'Current level: ' + current + '.');
          return;
        }
      }

      if (isReportOnly) {
        writeHookOutput(
          'UserPromptSubmit',
          mode,
          mode === 'off' ? 'PONYTAIL MODE OFF' : 'PONYTAIL MODE ACTIVE — level: ' + mode,
        );
      } else if (mode && mode !== 'off') {
        setMode(mode);
        modeSwitched = true;
        // ponytail: Qoder needs the full ruleset every turn, so when a mode
        // switch happens we fold the confirmation into the ruleset output
        // below (one JSON on stdout) instead of emitting two separate writes.
        if (!isQoder) {
          // Cursor has no /ponytail command that would load the skill body
          // for the new level, so the tracker delivers that level's ruleset
          // along with the confirmation (#817).
          const header = 'PONYTAIL MODE CHANGED — level: ' + mode;
          writeHookOutput(
            'UserPromptSubmit',
            mode,
            isCursor ? header + '\n\n' + getPonytailInstructions(mode) : header,
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
        // First prompt of this session (its state is per session, and "off" is
        // recorded explicitly, so absence can no longer mean "turned off").
        currentMode = getDefaultMode();
        try { setMode(currentMode); } catch (e) {}
        pruneStaleSessionState();
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
  } catch (e) {
    // Silent fail
  }
}

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);

// Never hang the session. On Windows, Claude Code runs this hook through a
// PowerShell `if {}` wrapper that can swallow the piped prompt JSON, so stdin
// 'end' never fires and the hook blocks forever — freezing the session (#443).
// On error, or after a short fallback, process whatever arrived (recovering the
// mode if data came without EOF) and exit. unref() keeps the timer from adding
// latency to the normal path, where 'end' fires first. Mirrors the best-effort,
// never-block contract the other lifecycle hooks already follow.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
