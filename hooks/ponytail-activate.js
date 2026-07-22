#!/usr/bin/env node
// ponytail — session-start activation hook
//
// Runs on every session start:
//   1. Stores host-appropriate session state
//   2. Emits Ponytail instructions as hidden SessionStart context
//   3. On legacy hosts, detects missing statusline config and emits a setup nudge

const fs = require('fs');
const path = require('path');
const { getDefaultMode, getClaudeDir, isShellSafe } = require('./ponytail-config');
const { getPonytailInstructions } = require('./ponytail-instructions');
const { startSession } = require('./ponytail-codex-session');
const { readHookPayload } = require('./ponytail-stdin');
const {
  clearMode,
  isCodex,
  isCopilot,
  setMode,
  writeHookOutput,
} = require('./ponytail-runtime');

const claudeDir = getClaudeDir();
const settingsPath = path.join(claudeDir, 'settings.json');

if (isCodex) {
  readHookPayload((payload) => {
    if (!payload) return;
    const result = startSession(payload.session_id, payload.source, getDefaultMode());
    if (!result) return;
    try {
      writeHookOutput('SessionStart', result.mode, result.context);
    } catch (_) {}
  });
} else {
  activateLegacy();
}

function activateLegacy() {
  const mode = getDefaultMode();

  // "off" mode — skip activation entirely, don't write flag or emit rules
  if (mode === 'off') {
    clearMode();
    writeHookOutput('SessionStart', 'off', isCopilot ? '' : 'OK');
    return;
  }

  // 1. Write flag file
  try {
    setMode(mode);
  } catch (e) {
    // Silent fail -- flag is best-effort, don't block the hook
  }

  // 2. Emit the ponytail ruleset, filtered to the active intensity level.
  let output = getPonytailInstructions(mode);

  // 3. Detect missing statusline config — nudge Claude to help set it up
  if (!isCopilot) try {
    let hasStatusline = false;
    if (fs.existsSync(settingsPath)) {
      // Strip UTF-8 BOM some editors prepend on Windows (breaks JSON.parse)
      const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
      const settings = JSON.parse(raw);
      if (settings.statusLine) {
        hasStatusline = true;
      }
    }

    // Nudge at most once — the flag file marks that the user has already seen
    // (and implicitly declined) the statusline setup offer. Repeating it every
    // session start turns a helpful hint into a nag.
    const nudgeFlagPath = path.join(claudeDir, '.ponytail-statusline-nudged');
    if (!hasStatusline && !fs.existsSync(nudgeFlagPath)) {
      try { fs.writeFileSync(nudgeFlagPath, ''); } catch (e) { /* best-effort */ }
      const isWindows = process.platform === 'win32';
      const scriptName = isWindows ? 'ponytail-statusline.ps1' : 'ponytail-statusline.sh';
      const scriptPath = path.join(__dirname, scriptName);
      if (isShellSafe(scriptPath)) {
        const command = isWindows
          ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
          : `bash "${scriptPath}"`;
        const statusLineSnippet =
          '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
        output += "\n\n" +
          "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode " +
          "(e.g. [PONYTAIL], [PONYTAIL:ULTRA]). It is not configured yet. " +
          "To enable, add this to " + settingsPath + ": " +
          statusLineSnippet + " " +
          "Proactively offer to set this up for the user on first interaction.";
      } else {
        // ponytail: install path has shell metacharacters — don't embed it in a
        // command snippet; have the agent wire it up by hand instead.
        output += "\n\n" +
          "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode. " +
          "Its install path contains characters unsafe to embed in a shell command, so configure it manually: " +
          "add a statusLine command of type \"command\" that runs " + scriptName +
          " from the plugin's hooks directory to " + settingsPath + ", quoting/escaping the path for your shell. " +
          "Proactively offer to set this up for the user on first interaction.";
      }
    }
  } catch (e) {
    // Silent fail — don't block session start over statusline detection
  }

  try {
    writeHookOutput('SessionStart', mode, output);
  } catch (e) {
    // Silent fail — stdout closed/EPIPE at hook exit must not surface as a hook failure
  }
}
