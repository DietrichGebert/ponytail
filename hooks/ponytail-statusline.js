#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');

const stateDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const stateFile = '.ponytail-active';

let payload = {};
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8')) || {};
} catch (e) {
  // A manually invoked statusline or an older host may not provide JSON.
}

const workspace = payload && typeof payload.workspace === 'object' ? payload.workspace : {};
const projectDir = String(
  workspace.project_dir || workspace.current_dir || payload.cwd || process.env.CLAUDE_PROJECT_DIR || '',
).trim();
const flag = projectDir
  ? path.join(
    stateDir,
    'ponytail-modes',
    createHash('sha256').update(path.normalize(projectDir)).digest('hex'),
  )
  : path.join(stateDir, stateFile);

let mode;
try {
  mode = fs.readFileSync(flag, 'utf8').split(/\r?\n/, 1)[0].trim();
} catch (e) {
  process.exit(0);
}

// A project payload means a missing project flag is intentionally off; do not
// fall back to the shared mirror from another project (#1162).
if (!mode || mode === 'off') process.exit(0);

const color = mode === 'ultra' ? '173' : '108';
const label = mode === 'full' ? '[PONYTAIL]' : `[PONYTAIL:${mode.toUpperCase()}]`;
process.stdout.write(`\u001b[38;5;${color}m${label}\u001b[0m`);
