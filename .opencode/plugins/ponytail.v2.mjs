// ponytail — OpenCode V2 plugin.
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, persists /ponytail mode switches, and registers slash commands and
// skills so they work when the package is installed from npm. Reuses the shared
// instruction builder so Claude Code, Codex, pi, and OpenCode all read one
// source of truth.
//
// V2 port of ponytail.mjs:
//   config hook                        → ctx.command.transform / ctx.skill.transform
//   experimental.chat.system.transform → ctx.session.hook("context", ...)
//   command.execute.before             → the ponytail command's own execute()
//
// Load it from your opencode.json(c):
//   { "plugins": ["@dietrichgebert/ponytail"] }

import { createRequire } from 'module';
import { Plugin } from '@opencode/plugin';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The shared instruction builder is CommonJS; bridge to it from this ES module.
const require = createRequire(import.meta.url);
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/ponytail-config');

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

// Strip frontmatter and pull a scalar field out of a `key: value` line.
function parseFrontmatter(content) {
  const match = String(content || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const field = (key) => match[1].match(new RegExp(key + ':\\s*(.+)'))?.[1]?.trim();
  return { frontmatter: match[1], body: match[2].trim(), field };
}

// Tolerate CRLF: a Windows checkout (autocrlf) delivers \r\n, npm ships \n.
function parseCommandFile(filePath) {
  const parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
  if (!parsed) return null;
  return { description: parsed.field('description'), template: parsed.body };
}

export default Plugin.define({
  id: 'ponytail',
  async setup(ctx) {
    const log = (level, message) => {
      try {
        ctx.app && ctx.app.log({ body: { service: 'ponytail', level, message } });
      } catch (e) {}
    };

    // Append the ruleset to the system prompt every turn. The `context` hook
    // runs for the agent loop, matching V1's system transform scope.
    await ctx.session.hook('context', (event) => {
      const mode = readMode();
      if (mode === 'off') return;
      const instructions = getPonytailInstructions(mode);
      event.system.push({ type: 'text', text: instructions });
    });

    // Register slash commands so they work when installed from npm. The
    // ponytail command persists the mode before the prompt runs — the V2
    // replacement for V1's command.execute.before hook, since the plugin owns
    // the command. Mode applies from the next message, not the current one —
    // the context hook reads the flag this writes.
    await ctx.command.transform((editor) => {
      const commandDir = path.join(__dirname, '..', 'command');
      try {
        for (const file of fs.readdirSync(commandDir).filter((f) => f.endsWith('.md'))) {
          const name = path.basename(file, '.md');
          const parsed = parseCommandFile(path.join(commandDir, file));
          if (!parsed) continue;
          editor.add({
            name,
            description: parsed.description || '',
            execute: async ({ sessionID, prompt, delivery }) => {
              const args = String(prompt.text || '').trim();
              if (name === 'ponytail') {
                // `off` is persisted like any mode; the context hook reads it
                // and stays silent.
                const mode = args ? normalizePersistedMode(args) : getDefaultMode();
                if (mode) {
                  writeMode(mode);
                  log('info', 'ponytail ' + mode);
                }
              }
              await ctx.session.prompt({
                sessionID,
                delivery,
                text: parsed.template.replace(/\$ARGUMENTS/g, args),
              });
            },
          });
        }
      } catch (e) {}

      // Register the packaged skills directory the same way V1's config hook
      // added it to skills.paths, so npm installs still expose the skills.
      const skillsDir = path.resolve(__dirname, '../../skills');
      try {
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
          let content;
          try {
            content = fs.readFileSync(skillPath, 'utf8');
          } catch (e) {
            continue;
          }
          const parsed = parseFrontmatter(content);
          if (!parsed) continue;
          editor.add({
            id: entry.name,
            name: parsed.field('name') || entry.name,
            description: parsed.field('description') || '',
            location: skillPath,
            content: parsed.body,
          });
        }
      } catch (e) {}
    });
  },
});
