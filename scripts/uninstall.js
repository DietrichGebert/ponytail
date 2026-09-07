#!/usr/bin/env node
// ponytail — removes state ponytail wrote outside the plugin's own files:
// the ruleset scripts/install.js wrote into global instruction files, the mode
// flag, the config file, and the statusLine entry it added to settings.json.
// Plugin files themselves are removed by each host's own uninstall command
// (see README); this only cleans up what those commands can't see.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getConfigPath, getClaudeDir } = require('../hooks/ponytail-config');
const { HOSTS, BEGIN, END } = require('./install.js');

const STATUSLINE_SCRIPT = 'ponytail-statusline';

function removeIfExists(filePath, label) {
  try {
    fs.unlinkSync(filePath);
    console.log(`Removed ${label}: ${filePath}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// scripts/install.js writes the ruleset into instruction files the host CLIs
// know nothing about, so their own uninstall commands cannot see them either.
// Same job as the statusLine cleanup below: undo what ponytail wrote outside
// the plugin folder.
for (const host of HOSTS.filter((h) => h.file)) {
  const target = path.join(os.homedir(), host.file);
  let content;
  try {
    content = fs.readFileSync(target, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') continue;
    throw e;
  }

  if (host.copy) {
    // Same ownership test the installer applies before it writes: the directory
    // is the user's own, so a file that no longer carries our title is theirs.
    if (host.owner && content.includes(host.owner)) {
      removeIfExists(target, `${host.name} rules`);
    }
    continue;
  }

  const begin = content.indexOf(BEGIN);
  const end = content.indexOf(END);
  if (begin === -1 || end < begin) continue;
  const stripped = (content.slice(0, begin) + content.slice(end + END.length)).trim();
  if (stripped) {
    fs.writeFileSync(target, `${stripped}\n`, 'utf8');
    console.log(`Removed ponytail block from ${target}`);
  } else {
    // Nothing but our block was in there — the file only existed because of us.
    removeIfExists(target, `${host.name} instructions`);
  }
}

removeIfExists(path.join(getClaudeDir(), '.ponytail-active'), 'mode flag');
removeIfExists(getConfigPath(), 'config file');

const settingsPath = path.join(getClaudeDir(), 'settings.json');
try {
  const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
  const settings = JSON.parse(raw);
  const cmd = settings.statusLine && settings.statusLine.command;
  // Only remove the parts ponytail owns. If the user combined statuslines
  // (e.g. caveman && ponytail), keep the other plugin's command intact.
  // ponytail: splits on && / ; to detect other segments — good enough; a user
  // piping statuslines together is on their own.
  if (typeof cmd === 'string' && cmd.includes(STATUSLINE_SCRIPT)) {
    const parts = cmd
      .split(/&&|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    const others = parts.filter((s) => !s.includes(STATUSLINE_SCRIPT));
    if (others.length === 0) {
      delete settings.statusLine;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Removed ponytail statusLine entry from ${settingsPath}`);
    } else {
      settings.statusLine.command = others.join(' && ');
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Removed ponytail statusLine segment from ${settingsPath}`);
    }
  }
} catch (e) {
  if (e.code === 'ENOENT') {
    // no settings.json — nothing to clean
  } else if (e instanceof SyntaxError) {
    // ponytail: malformed settings.json — can't safely edit it; leave intact, warn
    console.warn(`settings.json is malformed — could not remove the ponytail statusLine entry. Remove it manually from: ${settingsPath} (${e.message})`);
  } else {
    throw e;
  }
}
