#!/usr/bin/env node
// ponytail — install or remove the Cursor hooks (hooks/cursor-hooks.json) in
// ~/.cursor/hooks.json (default) or <cwd>/.cursor/hooks.json (--project),
// merging with whatever hooks are already there. Only entries that run one of
// ponytail's own hooks/ponytail-*.js scripts are added or removed; every other
// hook stays as it was.
//
//   node scripts/cursor-hooks.js install [--project]
//   node scripts/cursor-hooks.js uninstall [--project]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isShellSafe } = require('../hooks/ponytail-config');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'hooks', 'cursor-hooks.json');
const PONYTAIL_HOOK = /ponytail-[\w-]+\.js/;

function isPonytailHook(entry) {
  return Boolean(entry && typeof entry.command === 'string' && PONYTAIL_HOOK.test(entry.command));
}

function hooksPath(scope) {
  return scope === 'project'
    ? path.join(process.cwd(), '.cursor', 'hooks.json')
    : path.join(os.homedir(), '.cursor', 'hooks.json');
}

// Missing file → empty config. Malformed JSON throws a SyntaxError so the
// caller can refuse to touch the file rather than overwrite it.
function readConfig(file) {
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) config = {};
  if (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)) config.hooks = {};
  return config;
}

function writeConfig(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// The template's PONYTAIL_DIR placeholder becomes this checkout's absolute
// path. Forward slashes run unchanged under cmd, PowerShell and bash, and the
// same allowlist that guards the statusline snippet keeps shell metacharacters
// out of the command string.
function ponytailEntries() {
  const root = ROOT.replace(/\\/g, '/');
  if (!isShellSafe(root)) {
    throw new Error('ponytail is checked out at a path with shell metacharacters (' + ROOT +
      '); move it, or copy hooks/cursor-hooks.json by hand and quote the path for your shell');
  }
  const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  const hooks = {};
  for (const [event, entries] of Object.entries(template.hooks)) {
    hooks[event] = entries.map((entry) => ({ ...entry, command: entry.command.replace(/PONYTAIL_DIR/g, root) }));
  }
  return hooks;
}

function stripPonytail(config) {
  for (const [event, entries] of Object.entries(config.hooks)) {
    if (!Array.isArray(entries)) continue;
    const kept = entries.filter((entry) => !isPonytailHook(entry));
    if (kept.length) config.hooks[event] = kept;
    else delete config.hooks[event];
  }
}

function install(scope) {
  const file = hooksPath(scope);
  const config = readConfig(file);
  if (config.version === undefined) config.version = 1;
  // Re-running replaces stale ponytail entries instead of duplicating them.
  stripPonytail(config);
  for (const [event, entries] of Object.entries(ponytailEntries())) {
    config.hooks[event] = [...(config.hooks[event] || []), ...entries];
  }
  writeConfig(file, config);
  return file;
}

// Returns the file it changed, or null when there was nothing of ponytail's in it.
function uninstall(scope) {
  const file = hooksPath(scope);
  if (!fs.existsSync(file)) return null;
  const config = readConfig(file);
  const before = JSON.stringify(config);
  stripPonytail(config);
  if (JSON.stringify(config) === before) return null;
  const otherKeys = Object.keys(config).filter((k) => k !== 'version' && k !== 'hooks');
  if (Object.keys(config.hooks).length === 0 && otherKeys.length === 0) {
    // Only ponytail lived here: drop the file rather than leave an empty husk.
    fs.unlinkSync(file);
  } else {
    writeConfig(file, config);
  }
  return file;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0];
  const scope = args.includes('--project') ? 'project' : 'user';
  try {
    if (action === 'install') {
      const file = install(scope);
      console.log('Installed ponytail hooks in ' + file);
      console.log('Cursor reloads hooks.json on save; start a new chat to activate.');
    } else if (action === 'uninstall') {
      const file = uninstall(scope);
      console.log(file
        ? 'Removed ponytail hooks from ' + file
        : 'No ponytail hooks in ' + hooksPath(scope));
    } else {
      console.error('usage: node scripts/cursor-hooks.js install|uninstall [--project]');
      process.exit(1);
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error(hooksPath(scope) + ' is not valid JSON; nothing was changed, fix it by hand (' + e.message + ')');
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }
}

module.exports = { hooksPath, install, isPonytailHook, uninstall };
