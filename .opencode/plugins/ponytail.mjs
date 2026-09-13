// ponytail — OpenCode plugin (V1 + V2 from one entrypoint).
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, persists /ponytail mode switches, and registers slash commands so
// they work when the package is installed from npm. Reuses the shared
// instruction builder so Claude Code, Codex, pi, and OpenCode all read one
// source of truth.
//
// V1 — add to opencode.json:
//   { "plugin": ["@dietrichgebert/ponytail"] }
// V2 — add to opencode.json(c):
//   { "plugins": ["@dietrichgebert/ponytail"] }
//
// Run from a checkout instead (the plugin finds hooks/ and skills/ relative
// to its own file):
//   V1 { "plugin": ["./.opencode/plugins/ponytail.mjs"] }
//   V2 { "plugins": ["./.opencode/plugins/ponytail.mjs"] }
//
// One default export serves both: V1 (object form, OpenCode >= 1.18.29) calls
// server(), V2 reads id + setup() and ignores server(). No @opencode/plugin
// dependency — Plugin.define is only a type helper, the runtime duck-types
// { id, setup }.

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
// Shared by V1 and V2 so switching OpenCode versions keeps the level.
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

// Resolve a /ponytail mode switch from raw command arguments: empty args mean
// the default level, anything unparseable means "don't touch the flag".
function resolveModeSwitch(args) {
  const text = String(args || '').trim();
  return text ? normalizePersistedMode(text) : getDefaultMode();
}

function persistModeSwitch(args, log) {
  // `off` is persisted like any mode; the injection reads it and stays silent.
  const mode = resolveModeSwitch(args);
  if (!mode) return;
  writeMode(mode);
  if (log) log('info', 'ponytail ' + mode);
}

// Command .md files live beside the plugin so npm installs carry them.
function loadCommands() {
  const commandDir = path.join(__dirname, '..', 'command');
  const out = [];
  try {
    for (const file of fs.readdirSync(commandDir).filter((f) => f.endsWith('.md'))) {
      const parsed = parseCommandFile(path.join(commandDir, file));
      if (parsed) out.push({ name: path.basename(file, '.md'), ...parsed });
    }
  } catch (e) {}
  return out;
}

// Expand $ARGUMENTS the way OpenCode core does for file-based commands:
// substitute the full argument string, or append it after a blank line when
// the template has no placeholder.
function expandTemplate(template, args) {
  const text = String(args || '');
  if (template.includes('$ARGUMENTS')) return template.split('$ARGUMENTS').join(text);
  return text ? template + '\n\n' + text : template;
}

// Skill registrations mirroring the V1 config.skills.paths entry, so the
// packaged skills/ are advertised without the user wiring paths by hand.
function loadSkills() {
  const skillsDir = path.resolve(__dirname, '../../skills');
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const location = path.join(skillsDir, entry.name, 'SKILL.md');
    let raw;
    try {
      raw = fs.readFileSync(location, 'utf8');
    } catch (e) {
      continue;
    }
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    let description;
    let content = raw;
    if (match) {
      content = match[2].trim();
      const folded = match[1].match(/description:\s*>\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))+)/);
      description = folded
        ? folded[1].replace(/\s+/g, ' ').trim()
        : match[1].match(/description:\s*(.+)/)?.[1]?.trim();
    }
    out.push({ id: entry.name, name: entry.name, description, location, content });
  }
  return out;
}

function buildV1Hooks(client) {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'ponytail', level, message } }); } catch (e) {}
  };

  const ponytailSkillsDir = path.resolve(__dirname, '../../skills');

  return {
    // Register slash commands + skills directory.
    config: async (config) => {
      if (!config.command) config.command = {};
      for (const cmd of loadCommands()) {
        config.command[cmd.name] = { description: cmd.description, template: cmd.template };
      }

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
      persistModeSwitch(input.arguments, log);
    },
  };
}

async function setup(ctx) {
  // Load before registering: V2 transform callbacks must stay synchronous.
  const commands = loadCommands();
  const skills = loadSkills();

  await ctx.command.transform((editor) => {
    for (const cmd of commands) {
      editor.add({
        name: cmd.name,
        description: cmd.description,
        execute: async ({ sessionID, prompt, delivery }) => {
          const args = (prompt && prompt.text) || '';
          if (cmd.name === 'ponytail') persistModeSwitch(args);
          await ctx.session.prompt({
            ...(prompt || {}),
            sessionID,
            text: expandTemplate(cmd.template, args),
            delivery,
          });
        },
      });
    }
  });

  if (skills.length > 0) {
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill);
    });
  }

  // V1's experimental.chat.system.transform, narrowed to the agent loop:
  // titles, compaction summaries, and transient generates skip the ruleset.
  await ctx.session.hook('context', (event) => {
    const mode = readMode();
    if (mode === 'off') return;
    event.system.push({ type: 'text', text: getPonytailInstructions(mode) });
  });
}

export default {
  id: 'ponytail',
  setup,
  // V1 entrypoint (object form, OpenCode >= 1.18.29).
  server: async ({ client } = {}) => buildV1Hooks(client),
};
