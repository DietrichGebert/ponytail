#!/usr/bin/env node
// ponytail — removes state ponytail wrote outside the plugin's own files:
// the mode flag, the config file, and the statusLine entry it added to
// settings.json. Plugin files themselves are removed by each host's own
// uninstall command (see README); this only cleans up what those commands
// can't see.

const fs = require('fs');
const path = require('path');
const { getConfigPath, getClaudeDir } = require('../hooks/ponytail-config');

function removeIfExists(filePath, label) {
  try {
    fs.unlinkSync(filePath);
    console.log(`Removed ${label}: ${filePath}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

removeIfExists(path.join(getClaudeDir(), '.ponytail-active'), 'mode flag');
removeIfExists(getConfigPath(), 'config file');

const settingsPath = path.join(getClaudeDir(), 'settings.json');
try {
  const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
  const settings = JSON.parse(raw);
  const cmd = settings.statusLine && settings.statusLine.command;
  // ponytail: substring-match the script name, then drop the whole statusLine
  // key. A combined statusline (e.g. caveman+ponytail) whose command contains
  // "ponytail-statusline" gets removed wholesale. Parse out only ponytail's part
  // if combined statuslines become common.
  if (typeof cmd === 'string' && cmd.includes('ponytail-statusline')) {
    delete settings.statusLine;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`Removed ponytail statusLine entry from ${settingsPath}`);
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
