#!/usr/bin/env node
// crewcut — removes state crewcut wrote outside the plugin's own files:
// the mode flag, the config file, the statusline script copy and the
// statusLine entry it added to settings.json. Plugin files themselves are removed by each host's
// own uninstall command (see README); this only cleans up what those
// commands can't see.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getConfigPath, getClaudeDir } = require('../hooks/crewcut-config');

const STATUSLINE_SCRIPT = /(?:^|[\s"'\\/])crewcut-statusline\.(?:sh|ps1)(?=$|[\s"'])/;

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
try {
  const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
  const settings = JSON.parse(raw);
  const cmd = settings.statusLine && settings.statusLine.command;
  // Only remove the parts crewcut owns. If the user combined statuslines
  // (e.g. caveman && crewcut), keep the other plugin's command intact.
  // crewcut: splits on && / ; to detect other segments — good enough; a user
  // piping statuslines together is on their own.
  if (typeof cmd === 'string' && STATUSLINE_SCRIPT.test(cmd)) {
    const parts = cmd
      .split(/&&|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    const others = parts.filter((s) => !STATUSLINE_SCRIPT.test(s));
    if (others.length === 0) {
      delete settings.statusLine;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Removed crewcut statusLine entry from ${settingsPath}`);
    } else {
      settings.statusLine.command = others.join(' && ');
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Removed crewcut statusLine segment from ${settingsPath}`);
    }
  }
} catch (e) {
  if (e.code === 'ENOENT') {
    // no settings.json — nothing to clean
  } else if (e instanceof SyntaxError) {
    // crewcut: malformed settings.json — can't safely edit it; leave intact, warn
    console.warn(`settings.json is malformed — could not remove the crewcut statusLine entry. Remove it manually from: ${settingsPath} (${e.message})`);
  } else {
    throw e;
  }
}
