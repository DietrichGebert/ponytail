// ponytail — OpenCode plugin.
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, persists /ponytail mode switches, and registers slash commands so
// they work when the package is installed from npm. Reuses the shared
// instruction builder so Claude Code, Codex, pi, and OpenCode all read one
// source of truth.
//
// OpenCode loads this as a server plugin — add it to your opencode.json:
//   { "plugins": ["@dietrichgebert/ponytail"] }
//
// Supports both OpenCode V2 (calls setup()) and V1 1.18.29+ (calls server())
// from one default export, per the V1→V2 migration guide. V2 setup registers
// the ruleset injection via ctx.session.hook("context"); the slash-command and
// skills-dir registration remain on the V1 server() entrypoint until the
// template-command → V2 PromptInput/command-editor port lands (the V2
// CommandDefinition is programmatic and has no `template` field).

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
const { parseCommandFile } = require('./ponytail-frontmatter.cjs');

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

// --- V2 entrypoint -----------------------------------------------------------
// OpenCode 2.0+ calls setup(ctx). Registers the ruleset injection on the
// session "context" hook (the V2 successor of "experimental.chat.system.
// transform"). The event.system array takes SystemPart objects, so we push
// { type: "text", text } rather than a raw string. Guarded so the plugin loads
// cleanly even if a runtime variant does not expose ctx.session.
async function setup(ctx) {
  if (ctx?.session?.hook) {
    await ctx.session.hook('context', (event) => {
      const mode = readMode();
      if (mode === 'off') return;
      const instructions = getPonytailInstructions(mode);
      if (Array.isArray(event?.system)) {
        event.system.push({ type: 'text', text: instructions });
      }
    });
  }
}

// --- V1 entrypoint -----------------------------------------------------------
// OpenCode 1.18.29+ calls server(). Returns the legacy hooks map: slash-command
// + skills-dir registration (config), ruleset injection
// (experimental.chat.system.transform), and /ponytail mode persistence
// (command.execute.before).
async function server(input = {}) {
  const { client } = input;
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'ponytail', level, message } }); } catch (e) {}
  };

  const ponytailSkillsDir = path.resolve(__dirname, '../../skills');

  return {
    // Register slash commands + skills directory.
    config: async (config) => {
      if (!config.command) config.command = {};
      const commandDir = path.join(__dirname, '..', 'command');
      try {
        for (const file of fs.readdirSync(commandDir).filter((f) => f.endsWith('.md'))) {
          const name = path.basename(file, '.md');
          const parsed = parseCommandFile(path.join(commandDir, file));
          if (parsed) config.command[name] = parsed;
        }
      } catch (e) {}

      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(ponytailSkillsDir)) {
        config.skills.paths.push(ponytailSkillsDir);
      }
    },

    // Append the ruleset to the system prompt every turn.
    'experimental.chat.system.transform': async (_input, output) => {
      const mode = readMode();
      if (mode === 'off') return;
      const instructions = getPonytailInstructions(mode);
      if (output.system.length > 0) {
        output.system[output.system.length - 1] += '\n\n' + instructions;
      } else {
        output.system.push(instructions);
      }
    },

    // Persist `/ponytail <level>` so the next turn's injection follows it.
    // ponytail: mode applies from the next message, not the current one — the
    // transform reads the flag the command writes. Good enough; switch to a
    // synchronous store if same-turn switching ever matters.
    'command.execute.before': async (input) => {
      if (!input || input.command !== 'ponytail') return;
      // `off` is persisted like any mode; the transform reads it and stays silent.
      const args = String(input.arguments || '').trim();
      const mode = args ? normalizePersistedMode(args) : getDefaultMode();
      if (!mode) return;
      writeMode(mode);
      log('info', 'ponytail ' + mode);
    },
  };
}

// Dual V1/V2 default export. V2 validates `default` as an object with `id` and
// `setup`; V1 1.18.29+ reads `server()`. Extra keys are ignored by each loader.
export default { id: 'ponytail', setup, server };
