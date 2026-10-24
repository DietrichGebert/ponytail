#!/usr/bin/env node
// crewcut — removes state crewcut wrote outside the plugin's own files:
// the mode flag, the config file and the statusline script copies. It never
// reads settings.json, which can hold credentials; it tells the user to remove
// the crewcut statusLine there by hand. Plugin files themselves are removed by each host's
// own uninstall command (see README); this only cleans up what those
// commands can't see.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getConfigPath, getClaudeDir } = require('../hooks/crewcut-config');

function removeIfExists(filePath, label) {
  try {
    fs.unlinkSync(filePath);
    console.log(`Removed ${label}: ${filePath}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

removeIfExists(path.join(getClaudeDir(), '.crewcut-active'), 'mode flag');
removeIfExists(path.join(getClaudeDir(), '.crewcut-statusline-nudged'), 'statusline nudge flag');
for (const dir of [path.join(getClaudeDir(), 'crewcut-modes'), path.join(process.env.CODEBUDDY_CONFIG_DIR || path.join(os.homedir(), '.codebuddy'), 'crewcut-modes')]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
    console.log(`Removed per-project mode flags: ${dir}`);
  }
}
removeIfExists(path.join(process.env.CODEBUDDY_CONFIG_DIR || path.join(os.homedir(), '.codebuddy'), '.crewcut-active'), 'CodeBuddy mode flag');
removeIfExists(getConfigPath(), 'config file');
// Statusline script copies the activate hook keeps in the config dir (#1032).
for (const name of ['crewcut-statusline.sh', 'crewcut-statusline.ps1']) {
  removeIfExists(path.join(getClaudeDir(), name), 'statusline script');
}

const settingsPath = path.join(getClaudeDir(), 'settings.json');
console.log(`If the statusLine in ${settingsPath} runs crewcut-statusline.sh or crewcut-statusline.ps1, remove it, or only that part of a combined command.`);
