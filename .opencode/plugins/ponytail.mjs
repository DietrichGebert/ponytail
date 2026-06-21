// ponytail — OpenCode plugin.
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, and persists /ponytail mode switches. Reuses the shared instruction
// builder so Claude Code, Codex, pi, and OpenCode all read one source of truth.
//
// OpenCode loads this as a server plugin — add it to your opencode.json:
//   { "plugin": ["./.opencode/plugins/ponytail.mjs"] }

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The shared instruction builder is CommonJS; bridge to it from this ES module.
const require = createRequire(import.meta.url);
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/ponytail-config');

const ponytailSkillsDir = path.resolve(__dirname, '../../skills');

// OpenCode has no flag-file convention of its own; keep mode beside its config.
const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.ponytail-active',
);
const sessionModes = new Map();

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

function getStatus(sessionID) {
  const globalMode = readMode();
  const sessionMode = sessionID ? sessionModes.get(sessionID) : undefined;

  return {
    globalMode,
    sessionMode,
    effectiveMode: sessionMode ?? globalMode,
    source: sessionMode ? 'session override' : 'global',
  };
}

function formatStatus(sessionID) {
  const status = getStatus(sessionID);

  return [
    `global: ${status.globalMode}`,
    `session: ${status.sessionMode ?? 'none'}`,
    `effective: ${status.effectiveMode}`,
    `source: ${status.source}`,
  ].join('\n');
}

export default async ({ client } = {}) => {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'ponytail', level, message } }); } catch (e) {}
  };

  return {
    // Register skills directory so opencode discovers ponytail skills.
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(ponytailSkillsDir)) {
        config.skills.paths.push(ponytailSkillsDir);
      }
    },

    // Append the ruleset to the system prompt every turn.
    'experimental.chat.system.transform': async (input, output) => {
      const sessionMode = input.sessionID ? sessionModes.get(input.sessionID) : undefined;
      const mode = sessionMode ?? readMode();
      if (mode === 'off') return;
      output.system.push(getPonytailInstructions(mode));
    },

    // Persist `/ponytail <level>` so the next turn's injection follows it.
    // ponytail: mode applies from the next message, not the current one — the
    // transform reads the flag the command writes. Good enough; switch to a
    // synchronous store if same-turn switching ever matters.
    'command.execute.before': async (input, output) => {
      if (!input) return;
      if (input.command === 'ponytail-status') {
        output.parts.push({ type: 'text', text: formatStatus(input.sessionID) });
        log('info', 'ponytail status');
        return;
      }
      if (input.command === 'ponytail-session') {
        if (!input.sessionID) {
          log('warn', 'ponytail-session missing sessionID');
          return;
        }
        const rawMode = (input.arguments || '').trim();
        const mode = rawMode ? normalizePersistedMode(rawMode) : getDefaultMode();
        if (!mode) {
          log('warn', 'ponytail-session invalid mode ' + rawMode);
          return;
        }
        sessionModes.set(input.sessionID, mode);
        log('info', 'ponytail session ' + mode);
        return;
      }
      if (input.command !== 'ponytail') return;
      // `off` is persisted like any mode; the transform reads it and stays silent.
      const mode = normalizePersistedMode((input.arguments || '').trim()) || getDefaultMode();
      writeMode(mode);
      log('info', 'ponytail ' + mode);
    },
  };
};
