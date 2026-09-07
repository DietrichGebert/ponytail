#!/usr/bin/env node
// Project-only install: edit just this checkout's hook entry, never user hooks.
const fs = require('fs');
const path = require('path');
const { isShellSafe, normalizeMode } = require('../hooks/ponytail-config');

function main() {
  const [action, project, mode, ...extra] = process.argv.slice(2);
  if (!['install', 'uninstall'].includes(action) || !project || extra.length ||
      (mode !== undefined && (action !== 'install' || !normalizeMode(mode)))) {
    throw new Error('Usage: node scripts/cursor.js install <project> [lite|full|ultra|off]\n' +
      '       node scripts/cursor.js uninstall <project>');
  }
  const root = path.resolve(__dirname, '..');
  if (!isShellSafe(root)) throw new Error('Keep the Ponytail checkout in a path without shell metacharacters.');
  const projectRoot = fs.realpathSync(project);
  if (!fs.statSync(projectRoot).isDirectory()) throw new Error('Project must be a directory.');
  const cursorDir = path.join(projectRoot, '.cursor');
  const configPath = path.join(cursorDir, 'hooks.json');
  const template = JSON.parse(fs.readFileSync(path.join(root, 'hooks/cursor-hooks.json'), 'utf8'));
  const baseCommand = template.hooks.sessionStart[0].command.replace('__PONYTAIL_ROOT__', root);
  const ownedCommands = new Set([baseCommand,
    ...['lite', 'full', 'ultra', 'off'].map(level => baseCommand + ' --mode ' + level)]);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (action === 'uninstall') return;
    config = { version: 1, hooks: {} };
  }
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(config) || (config.version !== undefined && config.version !== 1) ||
      (config.hooks !== undefined && !isObject(config.hooks))) {
    throw new Error('Unsupported Cursor hooks configuration; left unchanged.');
  }
  const hooks = config.hooks || {};
  const entries = hooks.sessionStart === undefined ? [] : hooks.sessionStart;
  if (!Array.isArray(entries)) throw new Error('sessionStart must be an array; left unchanged.');
  if (action === 'install' && fs.existsSync(path.join(cursorDir, 'rules/ponytail.mdc'))) {
    throw new Error('Move .cursor/rules/ponytail.mdc outside the rules directory first. ' +
      'The always-on rule duplicates hook instructions and overrides off. See docs/cursor.md.');
  }
  const others = entries.filter(entry => !entry || !ownedCommands.has(entry.command));
  if (action === 'uninstall' && others.length === entries.length) return;
  if (action === 'install') {
    others.push({ ...template.hooks.sessionStart[0],
      command: baseCommand + (mode === undefined ? '' : ' --mode ' + normalizeMode(mode)) });
    config.version = 1;
  }
  config.hooks = hooks;
  if (others.length) hooks.sessionStart = others;
  else delete hooks.sessionStart;
  fs.mkdirSync(cursorDir, { recursive: true });
  // Write beside the destination, then rename so Cursor never reads partial JSON.
  const temporary = configPath + '.ponytail-' + process.pid;
  try {
    fs.writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temporary, configPath);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  console.log(action === 'install'
    ? 'Installed Cursor sessionStart hook. Start a new chat to apply the mode.'
    : 'Removed this checkout\'s Cursor hook. Start a new chat; existing context is unchanged.');
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
