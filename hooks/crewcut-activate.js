#!/usr/bin/env node
// crewcut — Claude Code SessionStart activation hook (also Codex, Copilot,
// Grok, CodeBuddy and Cursor sessionStart)
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.crewcut-active (defaults to ~/.claude; statusline reads this)
//   2. Emits crewcut ruleset as hidden SessionStart context
//   3. Offers the statusline setup once

const fs = require('fs');
const path = require('path');
const { getDefaultMode, getClaudeDir, isShellSafe } = require('./crewcut-config');
const { getCrewcutInstructions } = require('./crewcut-instructions');
const {
  clearMode,
  cursorRuleNotice,
  cursorRulePath,
  isCodeBuddy,
  isCodex,
  isCopilot,
  isCursor,
  setMode,
  writeHookOutput,
} = require('./crewcut-runtime');

const claudeDir = getClaudeDir();
const settingsPath = path.join(claudeDir, 'settings.json');

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  clearMode();
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

// 2. Emit the crewcut ruleset, filtered to the active intensity level.
let output = getCrewcutInstructions(mode);

// 2b. Codebase map: what already exists, so "reuse first" costs no search. Fail open: a map
// that cannot be built must never block or slow the session start.
if (mode !== 'review' && process.env.CREWCUT_MAP !== '0') try {
  const map = require('./crewcut-map').buildMap(process.cwd());
  if (map) output += '\n\n' + map;
} catch (e) { /* no map */ }

// 3. Offer the statusline once. settings.json is never read: the flag file alone
// decides, and the model checks the user's settings when it makes the offer.
if (!isCodex && !isCopilot && !isCursor && !isCodeBuddy) try {
  const isWindows = process.platform === 'win32';
  const scriptName = isWindows ? 'crewcut-statusline.ps1' : 'crewcut-statusline.sh';
  const scriptPath = path.join(claudeDir, scriptName);

  // Nudge at most once — the flag file marks that the user has already seen
  // (and implicitly declined) the statusline setup offer. Repeating it every
  // session start turns a helpful hint into a nag.
  const nudgeFlagPath = path.join(claudeDir, '.crewcut-statusline-nudged');
  const nudge = !fs.existsSync(nudgeFlagPath);

  // The plugin root is a versioned cache dir (.../crewcut/4.12.0/) that Claude
  // Code deletes on update, so a statusLine pointing into it goes blank after the
  // next update (#1032). The offer points at a copy in the config dir instead.
  // Refresh every copy each session so script fixes ship with plugin updates.
  // Copy to a new temp file, then rename: the rename replaces a symlink at the
  // copy instead of writing through it, and a concurrent session never runs a
  // half-written script.
  for (const name of ['crewcut-statusline.ps1', 'crewcut-statusline.sh']) {
    const copyPath = path.join(claudeDir, name);
    if (!(nudge && name === scriptName) && !fs.existsSync(copyPath)) continue;
    const tmpPath = copyPath + '.' + process.pid + '.tmp';
    try {
      fs.copyFileSync(path.join(__dirname, name), tmpPath, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(tmpPath, 0o644);
      fs.renameSync(tmpPath, copyPath);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (e) { /* renamed */ }
    }
  }

  if (nudge) {
    try { fs.writeFileSync(nudgeFlagPath, ''); } catch (e) { /* best-effort */ }
    const offer = "If " + settingsPath + " has a statusLine that runs crewcut-statusline from another path, " +
      "offer to point it at " + scriptPath + ". If it has no statusLine, proactively offer to set this up " +
      "for the user on first interaction. Leave any other statusLine alone.";
    if (isShellSafe(scriptPath)) {
      const command = isWindows
        ? `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        : `bash "${scriptPath}"`;
      const statusLineSnippet =
        '"statusLine": { "type": "command", "command": ' + JSON.stringify(command) + ' }';
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The crewcut plugin includes a statusline badge showing active mode " +
        "(e.g. [CREWCUT], [CREWCUT:ULTRA]). " +
        "To enable, add this to " + settingsPath + ": " +
        statusLineSnippet + " " + offer;
    } else {
      // crewcut: config dir path has shell metacharacters; don't embed it in a
      // command snippet; have the agent wire it up by hand instead.
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The crewcut plugin includes a statusline badge showing active mode. " +
        "Its path contains characters unsafe to embed in a shell command, so configure it manually: " +
        "add a statusLine command of type \"command\" that runs " + scriptName +
        " from " + claudeDir + " to " + settingsPath + ", quoting/escaping the path for your shell. " + offer;
    }
  }
} catch (e) {
  // Silent fail — don't block session start over statusline setup
}

try {
  writeHookOutput('SessionStart', mode, output);
} catch (e) {
  // Silent fail — stdout closed/EPIPE at hook exit must not surface as a hook failure
}
