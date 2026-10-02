#!/usr/bin/env node
// ponytail — Claude Code SessionStart activation hook (also Codex, Copilot,
// Grok and Cursor sessionStart)
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.ponytail-active (defaults to ~/.claude; statusline reads this)
//   2. Emits ponytail ruleset as hidden SessionStart context
//   3. Detects missing statusline config and emits setup nudge

const fs = require('fs');
const path = require('path');
const { getDefaultMode, getClaudeDir, isShellSafe } = require('./ponytail-config');
const { getPonytailInstructions } = require('./ponytail-instructions');
const {
  clearMode,
  cursorRuleNotice,
  cursorRulePath,
  isCodex,
  isCopilot,
  isCursor,
  setMode,
  writeHookOutput,
} = require('./ponytail-runtime');

const claudeDir = getClaudeDir();
const settingsPath = path.join(claudeDir, 'settings.json');

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  clearMode();
  const hookOutput = (isCodex || isCopilot || isCursor) ? '' : 'OK';
  writeHookOutput('SessionStart', 'off', hookOutput);
  process.exit(0);
}

// Cursor with the always-on rule in the workspace: the rule already carries the
// ruleset and would contradict any other level, so leave the flag alone and
// hand the model a one-line notice instead of a second copy (#817).
if (isCursor) {
  const rule = cursorRulePath();
  if (rule) {
    try {
      writeHookOutput('SessionStart', mode, cursorRuleNotice(rule));
    } catch (e) {
      // Silent fail — stdout closed/EPIPE at hook exit must not surface as a hook failure
    }
    process.exit(0);
  }
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
if (!isCodex && !isCopilot && !isCursor) try {
  // Claude Code has one statusLine slot, so chain into it rather than take it:
  // the badge prints with no trailing newline, so going first keeps both on one
  // row, and an inactive ponytail leaves the rest of the line untouched. Uses
  // ';' not '&&' — Claude Code falls back to PowerShell, and 5.1 cannot parse it.
  let existing = '';      // command already in the slot, to run after the badge
  let options = null;     // its sibling keys (padding, refreshInterval, ...)
  let configured = false; // ponytail is already there, or it isn't ours to chain
  if (fs.existsSync(settingsPath)) {
    // Strip UTF-8 BOM some editors prepend on Windows (breaks JSON.parse)
    const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
    const statusLine = JSON.parse(raw).statusLine;
    const cmd = statusLine && statusLine.command;
    if (typeof cmd === 'string') {
      if (cmd.includes('ponytail-statusline')) configured = true;
      else { existing = cmd; options = statusLine; }
    } else if (statusLine) {
      // A statusLine that isn't a string command — nothing safe to chain onto.
      configured = true;
    }
  }

  // Nudge at most once — the flag file marks that the user has already seen
  // (and implicitly declined) the statusline setup offer. Repeating it every
  // session start turns a helpful hint into a nag.
  const nudgeFlagPath = path.join(claudeDir, '.ponytail-statusline-nudged');
  if (!configured && !fs.existsSync(nudgeFlagPath)) {
    try { fs.writeFileSync(nudgeFlagPath, ''); } catch (e) { /* best-effort */ }
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'ponytail-statusline.ps1' : 'ponytail-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
    if (isShellSafe(scriptPath)) {
      const command = isWindows
        ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        : `bash "${scriptPath}"`;
      const composed = existing ? `${command} ; ${existing}` : command;
      const statusLineSnippet = '"statusLine": ' +
        JSON.stringify(Object.assign({}, options, { type: 'command', command: composed }));
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode " +
        "(e.g. [PONYTAIL], [PONYTAIL:ULTRA]). It is not configured yet. " +
        "To enable, set this in " + settingsPath + ": " +
        statusLineSnippet + " " +
        (existing ? "The badge chains in front of the status line already configured there, which keeps working unchanged. " : "") +
        "Proactively offer to set this up for the user on first interaction.";
    } else {
      // ponytail: install path has shell metacharacters — don't embed it in a
      // command snippet; have the agent wire it up by hand instead.
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode. " +
        "Its install path contains characters unsafe to embed in a shell command, so configure it manually: " +
        "add a statusLine command of type \"command\" that runs " + scriptName +
        " from the plugin's hooks directory to " + settingsPath + ", quoting/escaping the path for your shell. " +
        (existing ? "Chain it before the command already there with ';' so both render on one row. " : "") +
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
