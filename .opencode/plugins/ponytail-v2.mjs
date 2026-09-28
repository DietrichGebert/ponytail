// ponytail — OpenCode 2.x plugin.
//
// Same behavior as the 1.x plugin (ponytail.mjs), on the V2 host API: hooks
// are registered through the setup context instead of returned from it.
// Injects the ruleset into every session's system prompt (sub-agent sessions
// included) at the active intensity, registers the /ponytail commands and
// bundled skills, and persists /ponytail mode switches.
//
// Add it to your opencode.json:
//   { "plugins": ["@dietrichgebert/ponytail"] }

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The shared instruction builder is CommonJS; bridge to it from this ES module.
const require = createRequire(import.meta.url);
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { readMode, writeMode, modeFromArgs } = require('./ponytail-state.cjs');
const { parseCommandFile, parseSkillFile } = require('./ponytail-frontmatter.cjs');

function readCommands() {
  const commandDir = path.join(__dirname, '..', 'command');
  try {
    return fs.readdirSync(commandDir)
      .filter((f) => f.endsWith('.md'))
      .map((file) => ({ name: path.basename(file, '.md'), ...parseCommandFile(path.join(commandDir, file)) }))
      .filter((command) => command.template);
  } catch (e) {
    return [];
  }
}

function readSkills() {
  const skillsDir = path.resolve(__dirname, '../../skills');
  try {
    return fs.readdirSync(skillsDir)
      .map((dir) => path.join(skillsDir, dir, 'SKILL.md'))
      .filter((file) => fs.existsSync(file))
      .map((file) => ({ ...parseSkillFile(file), path: file }))
      .filter((skill) => skill.name);
  } catch (e) {
    return [];
  }
}

// The invocation prompt carries the text after the command name; drop a
// leading `/name` in case the host passes the raw input line.
function commandArgs(invocation, name) {
  const text = String(invocation?.prompt?.text || '').trim();
  return text.startsWith('/' + name) ? text.slice(name.length + 1).trim() : text;
}

export default {
  id: 'ponytail',
  async setup(ctx) {
    const registrations = [];

    // Append the ruleset to the system prompt of every model request.
    registrations.push(await ctx.session.hook('context', (event) => {
      const mode = readMode();
      if (mode === 'off') return;
      event.system.push({ type: 'text', text: getPonytailInstructions(mode) });
    }));

    registrations.push(await ctx.command.transform((editor) => {
      for (const command of readCommands()) {
        editor.add({
          name: command.name,
          description: command.description,
          execute: async (invocation) => {
            const args = commandArgs(invocation, command.name);
            if (command.name === 'ponytail') {
              // `off` is persisted like any mode; the context hook reads it and
              // stays silent. Written before the prompt, so it applies this turn.
              const mode = modeFromArgs(args);
              if (mode) writeMode(mode);
            }
            await ctx.session.prompt({
              sessionID: invocation.sessionID,
              text: command.template.replaceAll('$ARGUMENTS', args),
            });
          },
        });
      }
    }));

    registrations.push(await ctx.skill.transform((editor) => {
      for (const skill of readSkills()) {
        if (editor.get(skill.name)) continue;
        editor.add({ id: skill.name, ...skill });
      }
    }));

    return async () => {
      await Promise.all(registrations.map((registration) => registration.dispose()));
    };
  },
};
