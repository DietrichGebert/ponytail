'use strict';

// ponytail mode flag shared by the OpenCode V1 and V2 plugin entrypoints.
//
// Kept in its own CommonJS module so neither plugin module exports anything
// besides its plugin: OpenCode's legacy loader treats every exported function
// as a plugin (see ponytail-frontmatter.cjs).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/ponytail-config');

// OpenCode has no flag-file convention of its own; keep mode beside its config.
const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.ponytail-active',
);

function readMode() {
  try {
    return normalizePersistedMode(fs.readFileSync(statePath, 'utf8').trim()) || getDefaultMode();
  } catch (e) {
    return getDefaultMode();
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

// `/ponytail <level>` argument -> mode to persist, or null for an unknown level.
function modeFromArgs(args) {
  const trimmed = String(args || '').trim();
  return trimmed ? normalizePersistedMode(trimmed) : getDefaultMode();
}

module.exports = { readMode, writeMode, modeFromArgs };
