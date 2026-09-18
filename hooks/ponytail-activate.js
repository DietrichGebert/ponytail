#!/usr/bin/env node
// ponytail — Claude Code SessionStart activation hook (also Codex, Copilot,
// Grok and Cursor sessionStart)
//
// Runs on every session start:
//   1. Writes the session-scoped flag when the hook payload has a session id
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
let input = '';
let done = false;

function finish() {
  if (done) return;
  done = true;

  let data = null;
  try {
    data = JSON.parse(input.replace(/^\uFEFF/, ''));
  } catch (e) {}

  const mode = getDefaultMode();
  if (mode === 'off') {
    clearMode(data);
    const hookOutput = (isCodex || isCopilot || isCursor) ? '' : 'OK';
    writeHookOutput('SessionStart', 'off', hookOutput);
    return;
  }

  // Cursor's always-on rule already carries the ruleset; a second copy could
  // contradict it (#817).
  if (isCursor) {
    const rule = cursorRulePath();
    if (rule) {
      try {
        writeHookOutput('SessionStart', mode, cursorRuleNotice(rule));
      } catch (e) {
        // Silent fail — stdout closed/EPIPE at hook exit must not surface as a hook failure
      }
      return;
    }
  }

  try {
    setMode(mode, data);
  } catch (e) {
    // Silent fail -- flag is best-effort, don't block the hook
  }

  let output = getPonytailInstructions(mode);

  if (!isCodex && !isCopilot && !isCursor) try {
    let hasStatusline = false;
    if (fs.existsSync(settingsPath)) {
      // Strip UTF-8 BOM some editors prepend on Windows (breaks JSON.parse)
      const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
      const settings = JSON.parse(raw);
      if (settings.statusLine) {
        hasStatusline = true;
      }
    }

    // Nudge at most once; repeating it every session start turns a hint into a nag.
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
          "To enable it, add this to " + settingsPath + ": " +
          statusLineSnippet + " " +
          "Proactively offer to set this up on first interaction.";
      } else {
        // ponytail: install path has shell metacharacters — don't embed it in a
        // command snippet; have the agent wire it up by hand instead.
        output += "\n\n" +
          "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode. " +
          "Its install path contains characters unsafe to embed in a shell command, so configure it manually: " +
          "add a statusLine command of type \"command\" that runs " + scriptName +
          " from the plugin's hooks directory to " + settingsPath + ", quoting/escaping the path for your shell. " +
          "Proactively offer to set this up on first interaction.";
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

process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', finish);
// Never hang the session (#443); unparseable or absent stdin uses the legacy flag.
process.stdin.on('error', () => { finish(); process.exit(0); });
setTimeout(() => { finish(); process.exit(0); }, 1000).unref();
