#!/usr/bin/env node
// ponytail — Claude Code SessionStart activation hook (also Codex, Copilot,
// Grok, CodeBuddy and Cursor sessionStart)
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
  isCodeBuddy,
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
if (!isCodex && !isCopilot && !isCursor && !isCodeBuddy) try {
  const isWindows = process.platform === 'win32';
  let statusCommand = null;
  if (fs.existsSync(settingsPath)) {
    // Strip UTF-8 BOM some editors prepend on Windows (breaks JSON.parse)
    const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
    const settings = JSON.parse(raw);
    if (settings.statusLine) {
      statusCommand = String(settings.statusLine.command || '');
    }
  }

  // A statusLine already set up before #1032 can still run a script from a
  // plugin version that has since been deleted. Only absolute paths are checked,
  // so ~ or $HOME forms are never mistaken for missing files.
  const ref = statusCommand &&
    statusCommand.match(/"([^"]*ponytail-statusline\.(?:sh|ps1))"|(\S*ponytail-statusline\.(?:sh|ps1))/);
  const refPath = ref ? (ref[1] || ref[2]) : null;
  // isShellSafe keeps quotes, newlines and shell metacharacters from
  // settings.json out of the model context.
  // On Windows only drive-letter or UNC paths count: a Git Bash path such as
  // /c/Users/... is absolute to Node but does not resolve, so it would be
  // flagged as broken while it works.
  const checkable = refPath && isShellSafe(refPath) && path.isAbsolute(refPath) &&
    (!isWindows || /^([A-Za-z]:[\\/]|\\\\)/.test(refPath));
  const stalePath = checkable && !fs.existsSync(refPath) ? refPath : null;

  // The plugin root is a versioned cache dir (.../ponytail/4.12.0/) that Claude
  // Code deletes on update, so a statusLine pointing into it goes blank after the
  // next update (#1032). Point it at a copy in the config dir instead. A statusLine
  // that already runs ponytail keeps its script type, so its copy stays fresh.
  const usePs1 = refPath ? refPath.endsWith('.ps1') : isWindows;
  const scriptName = usePs1 ? 'ponytail-statusline.ps1' : 'ponytail-statusline.sh';
  const scriptPath = path.join(claudeDir, scriptName);

  // Nudge at most once — the flag file marks that the user has already seen
  // (and implicitly declined) the statusline setup offer. Repeating it every
  // session start turns a helpful hint into a nag. A broken path is nudged once
  // per path: the flag records it.
  const nudgeFlagPath = path.join(claudeDir, '.ponytail-statusline-nudged');
  let nudged = null;
  try { nudged = fs.readFileSync(nudgeFlagPath, 'utf8'); } catch (e) { /* not nudged yet */ }
  const nudge = stalePath ? nudged !== stalePath : statusCommand === null && nudged === null;

  // Refresh the copy every session so script fixes ship with plugin updates.
  // Copy to a new temp file, then rename: the rename replaces a symlink at
  // scriptPath instead of writing through it, and a concurrent session never
  // runs a half-written script.
  if (nudge || fs.existsSync(scriptPath)) {
    const tmpPath = scriptPath + '.' + process.pid + '.tmp';
    try {
      fs.copyFileSync(path.join(__dirname, scriptName), tmpPath, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(tmpPath, 0o644);
      fs.renameSync(tmpPath, scriptPath);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (e) { /* renamed */ }
    }
  }

  if (nudge) {
    try { fs.writeFileSync(nudgeFlagPath, stalePath || ''); } catch (e) { /* best-effort */ }
    if (stalePath) {
      output += "\n\n" +
        "STATUSLINE BROKEN: The statusLine in " + settingsPath + " runs " + stalePath +
        ", which no longer exists (the ponytail plugin was updated and its old version removed), " +
        "so the ponytail badge is blank. Replace that path with " + scriptPath + ", which survives updates, " +
        "quoting it for your shell. Keep the rest of the command. " +
        "Proactively offer to fix this for the user on first interaction.";
    } else if (isShellSafe(scriptPath)) {
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
      // ponytail: config dir path has shell metacharacters; don't embed it in a
      // command snippet; have the agent wire it up by hand instead.
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode. " +
        "Its path contains characters unsafe to embed in a shell command, so configure it manually: " +
        "add a statusLine command of type \"command\" that runs " + scriptName +
        " from " + claudeDir + " to " + settingsPath + ", quoting/escaping the path for your shell. " +
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
