// ponytail — OpenCode plugin.
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, persists /ponytail mode switches, and registers the /ponytail
// commands and skills so they work when the package is installed from npm.
// Reuses the shared instruction builder so Claude Code, Codex, pi, and OpenCode
// all read one source of truth.
//
// OpenCode loads this as a server plugin — add it to your opencode.json:
//   { "plugins": ["@dietrichgebert/ponytail"] }
//
// One default export serves both plugin APIs: V2 reads `id` + `setup`, V1 calls
// `server()`.

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
const { parseCommandFile, parseSkillFile } = require('./ponytail-frontmatter.cjs');

// OpenCode has no flag-file convention of its own; keep mode beside its config.
// Shared with the V1 path, so a level set under either API is read by both.
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

// `off` is persisted like any mode; the injection reads it and stays silent.
// An unrecognized level leaves the current one alone. The write lands before
// the next turn's injection, not the current one — good enough; switch to a
// synchronous store if same-turn switching ever matters.
function persistMode(args) {
  const wanted = String(args == null ? '' : args).trim();
  const mode = wanted ? normalizePersistedMode(wanted) : getDefaultMode();
  if (!mode) return;
  writeMode(mode);
  console.log('ponytail ' + mode);
}

// V2 has no `config` hook: the domains that own these definitions own them now,
// so the command and skill files are read once here and handed to the
// transforms that register them.
function readCommands() {
  const dir = path.join(__dirname, '..', 'command');
  try {
    return fs.readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const parsed = parseCommandFile(path.join(dir, file));
        return parsed && { name: path.basename(file, '.md'), ...parsed };
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function readSkills() {
  const dir = path.resolve(__dirname, '../../skills');
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const file = path.join(dir, entry.name, 'SKILL.md');
        const parsed = parseSkillFile(file);
        return parsed && {
          id: entry.name,
          name: parsed.name || entry.name,
          description: parsed.description,
          path: file,
          content: parsed.body,
        };
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

export default {
  id: 'ponytail',

  async setup(ctx) {
    const commands = readCommands();
    const skills = readSkills();

    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill);
    });

    await ctx.command.transform((editor) => {
      for (const command of commands) {
        editor.add({
          name: command.name,
          description: command.description,
          execute: async ({ sessionID, prompt, delivery }) => {
            if (command.name === 'ponytail') persistMode(prompt.text);
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: command.template.replaceAll('$ARGUMENTS', prompt.text || ''),
              delivery,
            });
          },
        });
      }
    });

    // Append the ruleset to the system prompt every turn. V2 hands over owned
    // system parts, so push one instead of rewriting the tail of another.
    await ctx.session.hook('context', (event) => {
      const mode = readMode();
      if (mode === 'off') return;
      event.system.push({ type: 'text', text: getPonytailInstructions(mode) });
    });
  },

  // OpenCode V1: same three behaviors, as hooks on the V1 hook names.
  async server({ client } = {}) {
    const log = (level, message) => {
      try { client && client.app && client.app.log({ body: { service: 'ponytail', level, message } }); } catch (e) {}
    };

    return {
      // Register slash commands + skills directory.
      config: async (config) => {
        if (!config.command) config.command = {};
        for (const command of readCommands()) {
          config.command[command.name] = { description: command.description, template: command.template };
        }

        config.skills = config.skills || {};
        config.skills.paths = config.skills.paths || [];
        const ponytailSkillsDir = path.resolve(__dirname, '../../skills');
        if (!config.skills.paths.includes(ponytailSkillsDir)) {
          config.skills.paths.push(ponytailSkillsDir);
        }
      },

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

      'command.execute.before': async (input) => {
        if (!input || input.command !== 'ponytail') return;
        persistMode(input.arguments);
        log('info', 'ponytail ' + readMode());
      },
    };
  },
};
