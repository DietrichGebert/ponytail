// gavel — OpenCode plugin.
//
// Injects the gavel QA ruleset into every chat's system prompt at the active
// intensity, persists /gavel mode switches, and registers slash commands so
// they work when the package is installed from npm.
//
// OpenCode loads this as a server plugin — add it to your opencode.json:
//   { "plugin": ["@dsolisp/gavel"] }

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The shared instruction builder is CommonJS; bridge to it from this ES module.
const require = createRequire(import.meta.url);

// OpenCode has no flag-file convention of its own; keep mode beside its config.
const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.gavel-active',
);

function readMode() {
  try {
    const mode = fs.readFileSync(statePath, 'utf8').trim();
    return ['lite', 'full', 'strict', 'off'].includes(mode) ? mode : 'full';
  } catch (e) {
    return 'full';
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

export function parseCommandFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const description = match[1].match(/description:\s*(.+)/)?.[1]?.trim();
  return { description, template: match[2].trim() };
}

export default async ({ client } = {}) => {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'gavel', level, message } }); } catch (e) {}
  };

  const gavelSkillsDir = path.resolve(__dirname, '../../skills');

  return {
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
      if (!config.skills.paths.includes(gavelSkillsDir)) {
        config.skills.paths.push(gavelSkillsDir);
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      const mode = readMode();
      if (mode === 'off') return;

      // Read AGENTS.md and inject as system prompt
      try {
        const agentsPath = path.resolve(__dirname, '../../AGENTS.md');
        const agentsContent = fs.readFileSync(agentsPath, 'utf8');
        output.system.push(`# Gavel QA Rules (mode: ${mode})\n\n${agentsContent}`);
      } catch (e) {}
    },

    'command.execute.before': async (input) => {
      if (!input || input.command !== 'gavel') return;
      const mode = (input.arguments || '').trim();
      const validMode = ['lite', 'full', 'strict', 'off'].includes(mode) ? mode : 'full';
      writeMode(validMode);
      log('info', 'gavel ' + validMode);
    },
  };
};
