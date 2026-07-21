#!/usr/bin/env node
// ponytail — Devin CLI lifecycle hook adapter
//
// Handles SessionStart, UserPromptSubmit and PostCompaction for Devin CLI.
// Devin CLI does not run plugin install scripts and does not load hooks from
// the plugin directory, so users copy this script to
//   ~/.config/devin/hooks/ponytail/ponytail-devin.js
// and register it via ~/.config/devin/hooks.v1.json (see scripts/devin-cli-setup.sh).
// The script locates the actual ponytail plugin checkout in Devin CLI's cache
// at runtime and reuses the shared config/instruction modules from there.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const EVENT = process.argv[2] || 'SessionStart';

function getCacheBase() {
  return process.env.PONYTAIL_PLUGIN_DIR
    || path.join(os.homedir(), '.local', 'share', 'devin', 'cli', 'plugins');
}

function findPluginDir() {
  const explicit = process.env.PONYTAIL_PLUGIN_DIR;
  if (explicit) return explicit;

  const cacheBase = getCacheBase();
  if (!fs.existsSync(cacheBase)) return null;

  // plugin cache layout: ~/.local/share/devin/cli/plugins/cache/<identity-hash>/<version>/
  const cacheDir = path.join(cacheBase, 'cache');
  const candidates = [];

  function addCandidate(dir) {
    if (!fs.existsSync(dir)) return;
    candidates.push({ dir, mtime: fs.statSync(dir).mtimeMs });
  }

  if (fs.existsSync(cacheDir)) {
    for (const identity of fs.readdirSync(cacheDir)) {
      const identityDir = path.join(cacheDir, identity);
      if (!fs.statSync(identityDir).isDirectory()) continue;
      for (const version of fs.readdirSync(identityDir)) {
        const pluginDir = path.join(identityDir, version);
        if (!fs.statSync(pluginDir).isDirectory()) continue;
        const pluginJson = path.join(pluginDir, '.devin-plugin', 'plugin.json');
        try {
          const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
          if (manifest.name === 'ponytail') {
            addCandidate(pluginDir);
          }
        } catch (e) { /* ignore unreadable entries */ }
      }
    }
  }

  // Local development installs may be linked under the plugins root.
  for (const entry of fs.readdirSync(cacheBase)) {
    if (entry === 'cache') continue;
    const pluginJson = path.join(cacheBase, entry, '.devin-plugin', 'plugin.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
      if (manifest.name === 'ponytail') {
        const dir = path.join(cacheBase, entry);
        candidates.push({ dir, mtime: fs.statSync(dir).mtimeMs });
      }
    } catch (e) { /* ignore */ }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].dir;
}

function requireFromPlugin(pluginDir, modulePath) {
  return require(path.join(pluginDir, modulePath));
}

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      resolve(input);
    }
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, 1000).unref();
  });
}

function writeDevinOutput(event, mode, context) {
  const output = {};
  if (mode) {
    output.systemMessage = `PONYTAIL:${mode.toUpperCase()}`;
  }
  if (context) {
    output.hookSpecificOutput = {
      hookEventName: event,
      additionalContext: context,
    };
  }
  process.stdout.write(JSON.stringify(output));
}

async function main() {
  const pluginDir = findPluginDir();
  if (!pluginDir) {
    // No plugin checkout found; fail silently so the session is not blocked.
    return;
  }

  const { getConfigDir, getDefaultMode, normalizeMode, normalizePersistedMode, isDeactivationCommand, writeDefaultMode } = requireFromPlugin(pluginDir, 'hooks/ponytail-config.js');
  const { getPonytailInstructions } = requireFromPlugin(pluginDir, 'hooks/ponytail-instructions.js');

  const stateDir = getConfigDir();
  const stateFile = path.join(stateDir, '.ponytail-active');

  function readMode() {
    try {
      return fs.readFileSync(stateFile, 'utf8').trim() || null;
    } catch (e) {
      return null;
    }
  }

  function setMode(mode) {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(stateFile, mode);
  }

  function clearMode() {
    try { fs.unlinkSync(stateFile); } catch (e) {}
  }

  function instructionsFor(mode, header) {
    if (!mode || mode === 'off') return '';
    const body = getPonytailInstructions(mode);
    return header ? `${header}\n\n${body}` : body;
  }

  // getPonytailInstructions already prefixes with the mode banner, so the header
  // passed to instructionsFor is an extra line (e.g. a mode-switch confirmation).


  if (EVENT === 'SessionStart') {
    const mode = getDefaultMode();
    if (mode === 'off') {
      clearMode();
    } else {
      setMode(mode);
      writeDevinOutput(EVENT, mode, instructionsFor(mode, ''));
    }
    return;
  }

  if (EVENT === 'PostCompaction') {
    const mode = readMode();
    if (mode && mode !== 'off') {
      writeDevinOutput(EVENT, mode, instructionsFor(mode, ''));
    }
    return;
  }

  if (EVENT === 'UserPromptSubmit') {
    const input = await readStdin();
    let data = {};
    try {
      data = JSON.parse(input.replace(/^\uFEFF/, ''));
    } catch (e) {}

    const prompt = String(data.prompt || '').trim().toLowerCase();

    if (isDeactivationCommand(prompt)) {
      clearMode();
      writeDevinOutput(EVENT, 'off', 'PONYTAIL MODE OFF');
      return;
    }

    let mode = readMode();
    let modeSwitched = false;
    let isReport = false;

    if (/^[/@$]ponytail/.test(prompt)) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0].replace(/^[@$]/, '/');
      const arg = parts[1] || '';

      if (cmd === '/ponytail' || cmd === '/ponytail:ponytail') {
        if (arg === 'default' && parts[2]) {
          const dmode = normalizeMode(parts[2]);
          if (dmode) {
            writeDefaultMode(dmode);
            writeDevinOutput(EVENT, dmode, `PONYTAIL DEFAULT SET — new sessions start in ${dmode}.`);
          }
          return;
        }

        if (arg === 'lite' || arg === 'full' || arg === 'ultra' || arg === 'off') {
          mode = normalizeMode(arg);
          modeSwitched = true;
        } else if (arg === '') {
          isReport = true;
          mode = readMode() || getDefaultMode();
        } else {
          // Unknown argument: report current/default mode without changing anything.
          isReport = true;
          mode = readMode() || getDefaultMode();
        }
      }
    }

    if (modeSwitched) {
      if (mode === 'off') {
        clearMode();
        writeDevinOutput(EVENT, 'off', 'PONYTAIL MODE OFF');
      } else {
        setMode(mode);
        writeDevinOutput(EVENT, mode, instructionsFor(mode, `PONYTAIL MODE CHANGED — level: ${mode}`));
      }
      return;
    }

    if (isReport) {
      if (mode && mode !== 'off') {
        writeDevinOutput(EVENT, mode, `PONYTAIL MODE ACTIVE — level: ${mode}`);
      } else {
        writeDevinOutput(EVENT, 'off', 'PONYTAIL MODE OFF');
      }
      return;
    }

    // Devin has SessionStart, so normally the state is already initialised.
    // If for some reason it is not (e.g. a hook was skipped), fall back to default.
    if (!mode) {
      mode = getDefaultMode();
      if (mode && mode !== 'off') {
        setMode(mode);
        writeDevinOutput(EVENT, mode, instructionsFor(mode, ''));
      }
    }
  }
}

main().catch(() => { /* best-effort: never block the session */ });
