#!/usr/bin/env node
// ponytail — Claude Code SessionStart activation hook
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
  isCodex,
  isCopilot,
  setMode,
  writeHookOutput,
} = require('./ponytail-runtime');

const claudeDir = getClaudeDir();
const settingsPath = path.join(claudeDir, 'settings.json');

// Known token-compression plugins that inject competing style instructions.
// When detected, ponytail adds a conflict note so the model knows to
// prioritize ponytail's code-shaping rules over competing prose-style rules.
const COMPRESSION_PLUGIN_IDS = ['caveman', 'grill-me', 'grilling'];

// Check if any known compression plugin is registered in settings.json.
function detectCompressionConflict(settingsFile) {
  try {
    if (!fs.existsSync(settingsFile)) return false;
    const raw = fs.readFileSync(settingsFile, 'utf8').replace(/^﻿/, '');
    const settings = JSON.parse(raw);
    const installed = settings.installed_plugins;
    if (installed && typeof installed === 'object') {
      for (const key of Object.keys(installed)) {
        for (const id of COMPRESSION_PLUGIN_IDS) {
          if (key.toLowerCase().includes(id)) return true;
        }
      }
    }
    const permissions = settings.permissions;
    if (permissions && typeof permissions === 'object') {
      for (const key of Object.keys(permissions)) {
        for (const id of COMPRESSION_PLUGIN_IDS) {
          if (key.toLowerCase().includes(id)) return true;
        }
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  clearMode();
  const hookOutput = (isCodex || isCopilot) ? '' : 'OK';
  writeHookOutput('SessionStart', 'off', hookOutput);
  process.exit(0);
}

// 1. Write flag file
try {
  setMode(mode);
} catch (e) {
  // Silent fail -- flag is best-effort, don't block the hook
}

// 2. Emit the ponytail ruleset, filtered to the active intensity level.
let output = getPonytailInstructions(mode);

// 2b. If another compression plugin is active, add a conflict note so the
// model knows ponytail governs code-shaping while the other plugin governs
// prose style. Without this, the model receives contradictory instructions.
const hasCompressionConflict = detectCompressionConflict(settingsPath);
if (hasCompressionConflict) {
  output += '\n\nCONCURRENT COMPRESSION PLUGIN DETECTED — another token-compression ' +
    'plugin (e.g. caveman) is also active. Ponytail governs WHAT you build ' +
    '(YAGNI, stdlib first, shortest diff). The other plugin governs HOW you ' +
    'talk (terse prose, drop articles). These are complementary, not ' +
    'contradictory. Apply both: ponytail for code decisions, the other ' +
    'plugin for output style.';
}

// 3. Detect missing statusline config — nudge Claude to help set it up
if (!isCodex && !isCopilot) try {
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    // Strip UTF-8 BOM some editors prepend on Windows (breaks JSON.parse)
    const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
    const settings = JSON.parse(raw);
    if (settings.statusLine) {
      hasStatusline = true;
    }
  }

  if (!hasStatusline) {
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
        "To enable, add this to ~/.claude/settings.json: " +
        statusLineSnippet + " " +
        "Proactively offer to set this up for the user on first interaction.";
    } else {
      // ponytail: install path has shell metacharacters — don't embed it in a
      // command snippet; have the agent wire it up by hand instead.
      output += "\n\n" +
        "STATUSLINE SETUP NEEDED: The ponytail plugin includes a statusline badge showing active mode. " +
        "Its install path contains characters unsafe to embed in a shell command, so configure it manually: " +
        "add a statusLine command of type \"command\" that runs " + scriptName +
        " from the plugin's hooks directory to ~/.claude/settings.json, quoting/escaping the path for your shell. " +
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
