#!/usr/bin/env node
// Shared config. One file reader and one env-flag helper feed default mode,
// quiet startup, and hide-status. review is session-only, never a default.

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_MODE = 'full';
const VALID_MODES = ['off', 'lite', 'full', 'ultra', 'review'];
const RUNTIME_MODES = ['off', 'lite', 'full', 'ultra'];

function normalizeMode(mode) {
  if (typeof mode !== 'string') return null;
  const normalized = mode.trim().toLowerCase();
  return RUNTIME_MODES.includes(normalized) ? normalized : null;
}

function normalizeConfigMode(mode) {
  if (typeof mode !== 'string') return null;
  const normalized = mode.trim().toLowerCase();
  return VALID_MODES.includes(normalized) ? normalized : null;
}

function normalizePersistedMode(mode) {
  return normalizeMode(mode) || normalizeConfigMode(mode);
}

// "stop ponytail" / "normal mode" turn ponytail off, but only as a standalone
// command. Matching the phrase anywhere in the message turned it off mid-task
// for ordinary requests like "add a normal mode toggle" — so require the whole
// message to be the command, ignoring case and trailing punctuation.
function isDeactivationCommand(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.!?\s]+$/, '');
  return t === 'stop ponytail' || t === 'normal mode';
}

// ponytail: only embed the plugin install path in a statusline shell command when
// it's made of ordinary path characters. An allowlist beats escaping every shell's
// metacharacters; a hostile clone path (quotes, &, $, backtick, ;, etc.) falls back
// to manual setup instead. Allows : \ / for normal Windows and POSIX paths. Full
// per-shell escaper only if a real need appears.
function isShellSafe(p) {
  return typeof p === 'string' && /^[A-Za-z0-9 _.\-:/\\~]+$/.test(p);
}

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'ponytail');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'ponytail'
    );
  }
  return path.join(os.homedir(), '.config', 'ponytail');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function getClaudeDir() {
  // ponytail: CLAUDE_CONFIG_DIR overrides ~/.claude, matching Claude Code.
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function envFlag(name) {
  const env = process.env[name];
  if (env === undefined) return undefined;
  const v = env.trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false' && v !== 'no';
}

function readConfigFile() {
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8').replace(/^\uFEFF/, ''));
    if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
    return config;
  } catch (_) {
    return {};
  }
}

function getDefaultMode() {
  const envMode = normalizeMode(process.env.PONYTAIL_DEFAULT_MODE);
  if (envMode) return envMode;
  const fileMode = normalizeMode(readConfigFile().defaultMode);
  if (fileMode) return fileMode;
  return DEFAULT_MODE;
}

function getQuietStartup() {
  const fromEnv = envFlag('PONYTAIL_QUIET_STARTUP');
  if (fromEnv !== undefined) return fromEnv;
  return readConfigFile().quietStartup === true;
}

function getHideStatus() {
  const fromEnv = envFlag('PONYTAIL_HIDE_STATUS');
  if (fromEnv !== undefined) return fromEnv;
  return readConfigFile().hideStatus === true;
}

function writeDefaultMode(mode) {
  const normalized = normalizeMode(mode);
  if (!normalized) return null;
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const config = readConfigFile();
  config.defaultMode = normalized;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return normalized;
}

module.exports = {
  DEFAULT_MODE,
  VALID_MODES,
  RUNTIME_MODES,
  getDefaultMode,
  getConfigDir,
  getConfigPath,
  getClaudeDir,
  getHideStatus,
  getQuietStartup,
  isShellSafe,
  normalizeMode,
  normalizeConfigMode,
  normalizePersistedMode,
  isDeactivationCommand,
  writeDefaultMode,
};
