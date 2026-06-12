#!/usr/bin/env node
// ponytail — SessionStart activation hook (Claude Code + OpenCode)
//
// Runs on every session start:
//   1. Writes flag file (statusline reads this)
//   2. Emits ponytail ruleset as hidden SessionStart context
//   3. Detects missing statusline config and emits setup nudge (Claude Code only)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode } = require('./ponytail-config');
const { getPonytailInstructions } = require('./ponytail-instructions');
const {
  clearMode,
  isCodex,
  setMode,
  writeHookOutput,
} = require('./ponytail-runtime');

const isOpenCode = Boolean(process.env.OPENCODE_PLUGIN_ROOT);
const statePath = isOpenCode
  ? path.join(os.homedir(), '.config', 'opencode', '.ponytail-active')
  : isCodex
    ? path.join(process.env.PLUGIN_DATA, '.ponytail-active')
    : path.join(os.homedir(), '.claude', '.ponytail-active');

const mode = getDefaultMode();

// "off" mode — skip activation entirely, don't write flag or emit rules
if (mode === 'off') {
  clearMode();
  writeHookOutput('SessionStart', 'off', isCodex ? '' : 'OK');
  process.exit(0);
}

// 1. Write flag file
try {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
} catch (e) {
  // Silent fail -- flag is best-effort, don't block the hook
}

// 2. Emit the ponytail ruleset, filtered to the active intensity level.
let output = getPonytailInstructions(mode);

// 3. Detect missing statusline config — nudge Claude to help set it up (Claude Code only)
if (!isCodex && !isOpenCode) try {
  const claudeDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  
  let hasStatusline = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.statusLine) {
      hasStatusline = true;
    }
  }

  if (!hasStatusline) {
    const isWindows = process.platform === 'win32';
    const scriptName = isWindows ? 'ponytail-statusline.ps1' : 'ponytail-statusline.sh';
    const scriptPath = path.join(__dirname, scriptName);
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
  }
} catch (e) {
  // Silent fail — don't block session start over statusline detection
}

writeHookOutput('SessionStart', mode, output);
