// ponytail — OpenCode plugin.
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, persists /ponytail mode switches, and registers slash commands so
// they work when the package is installed from npm. Reuses the shared
// instruction builder so Claude Code, Codex, pi, and OpenCode all read one
// source of truth.
//
// One module serves both OpenCode generations: V2 loads the default export's
// `setup(ctx)`, V1 (1.18.29+, object entrypoint) calls `server({ client })`.
// Add the package to your config:
//   V2: { "plugins": ["@dietrichgebert/ponytail"] }
//   V1: { "plugin":  ["@dietrichgebert/ponytail"] }

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// V2's Plugin.define brands the definition for its loader. Published installs
// declare @opencode/plugin as a dependency, but bare repo checkouts (the
// README's point-at-the-.mjs flow) have no node_modules — fall back to the raw
// definition object, which V2 also accepts (id + setup).
let definePlugin = (definition) => definition;
try {
  const { Plugin } = await import('@opencode/plugin');
  if (Plugin && typeof Plugin.define === 'function') definePlugin = Plugin.define;
} catch {}

// The shared instruction builder is CommonJS; bridge to it from this ES module.
const require = createRequire(import.meta.url);
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/ponytail-config');
const { parseCommandFile } = require('./ponytail-frontmatter.cjs');

// OpenCode has no flag-file convention of its own; keep mode beside its config.
// Deliberately NOT V2's ctx.storage: the flag is shared with the other host
// adapters (Claude Code, Codex, pi hooks), so a switch made in one host
// applies everywhere.
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

// --- registration data -------------------------------------------------------
//
// V2 transforms replay their (synchronous) callbacks, so every file is read
// once up front and the transform callbacks stay cheap and side-effect free.

function loadCommandFiles() {
  const commandDir = path.join(__dirname, '..', 'command');
  const commands = [];
  try {
    for (const file of fs.readdirSync(commandDir).filter((f) => f.endsWith('.md')).sort()) {
      const parsed = parseCommandFile(path.join(commandDir, file));
      if (parsed) commands.push({ name: path.basename(file, '.md'), ...parsed });
    }
  } catch (e) {}
  return commands;
}

// SKILL.md frontmatter uses folded (`>`) multiline descriptions. Parse the
// small YAML subset we ship, tolerating CRLF like the command parser does.
function parseSkillFile(skillDir) {
  const file = path.join(skillDir, 'SKILL.md');
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return null;
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const fields = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!head) continue;
    let value = head[2].trim();
    if (value === '' || value === '>' || value === '|') {
      const parts = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.join(value === '|' ? '\n' : ' ');
    }
    fields[head[1]] = value.replace(/^["']|["']$/g, '');
  }
  return {
    id: path.basename(skillDir),
    name: fields.name,
    description: fields.description,
    path: file,
    content: match[2].trim(),
  };
}

function loadSkillFiles() {
  const skillsDir = path.resolve(__dirname, '../../skills');
  const skills = [];
  try {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true }).sort()) {
      if (!entry.isDirectory()) continue;
      const skill = parseSkillFile(path.join(skillsDir, entry.name));
      if (skill && skill.name && skill.description) skills.push(skill);
    }
  } catch (e) {}
  return skills;
}

// --- V2 (OpenCode 2.x) -------------------------------------------------------

const v2 = definePlugin({
  id: 'ponytail',
  async setup(ctx) {
    const commands = loadCommandFiles();
    const skills = loadSkillFiles();

    // Register slash commands. The /ponytail switch persists the mode inside
    // its own execute, replacing V1's command.execute.before hook.
    // ponytail: mode applies from the next message, not the current one — the
    // context hook reads the flag the command writes. Good enough; switch to a
    // synchronous store if same-turn switching ever matters.
    await ctx.command.transform((editor) => {
      for (const { name, description, template } of commands) {
        editor.add({
          name,
          description,
          async execute({ sessionID, prompt, delivery }) {
            const args = String((prompt && prompt.text) || '').trim();
            let value = args;
            if (name === 'ponytail') {
              // `off` is persisted like any mode; the context hook reads it and stays silent.
              const mode = args ? normalizePersistedMode(args) : getDefaultMode();
              if (mode) {
                writeMode(mode);
                value = mode;
                console.log(`[ponytail] mode ${mode}`);
              }
            }
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              delivery,
              text: template.includes('$ARGUMENTS')
                ? template.replaceAll('$ARGUMENTS', value || 'full')
                : args
                  ? `${template}\n\n${args}`
                  : template,
            });
          },
        });
      }
    });

    // Register the skills shipped beside the plugin. V1 pointed
    // config.skills.paths at the directory; V2 has no config hook, so add each
    // parsed skill instead. Skill.Info requires { id, name, path, content } —
    // `path` (not `location`) per the V2 server schema.
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill);
    });

    // Append the ruleset to the system prompt of every agent-loop model
    // request. Registered for "context" only — not compaction/title/generate —
    // to match V1's experimental.chat.system.transform, which ran for chats.
    await ctx.session.hook('context', (event) => {
      const mode = readMode();
      if (mode === 'off') return;
      event.system.push({ type: 'text', text: getPonytailInstructions(mode) });
    });
  },
});

// --- V1 (OpenCode 1.18.29+ object entrypoint) --------------------------------

const server = async ({ client } = {}) => {
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
};

export default { ...v2, server };
