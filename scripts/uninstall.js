#!/usr/bin/env node
// Removes state ponytail wrote outside its own plugin files. `npm uninstall`
// removes the plugin itself; this cleans up what it can't see.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getConfigPath } = require('../hooks/ponytail-config');

const configHome =
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');

for (const [p, label] of [
  [path.join(configHome, 'opencode', '.ponytail-active'), 'mode flag'],
  [getConfigPath(), 'config file'],
]) {
  try {
    fs.unlinkSync(p);
    console.log(`Removed ${label}: ${p}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
