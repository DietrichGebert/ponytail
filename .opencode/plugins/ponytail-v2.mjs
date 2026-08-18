// Ponytail OpenCode V2 plugin. The root package export remains the V1 adapter.

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { getDefaultMode } = require('../../hooks/ponytail-config');
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { parseCommandFile } = require('./ponytail-frontmatter.cjs');

const commandDir = path.join(__dirname, '..', 'command');
const skillsDir = path.resolve(__dirname, '../../skills');

function skillDefinitions() {
  return fs.readdirSync(skillsDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const location = path.join(skillsDir, entry.name, 'SKILL.md');
    let source;
    try { source = fs.readFileSync(location, 'utf8'); } catch (_) { return []; }
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return [];
    const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    if (!name) return [];
    const description = match[1].match(/^description:\s*>?\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/m)?.[1]
      ?.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(' ');
    return [{ id: name, name, description, location, content: match[2].trim() }];
  });
}

export default {
  id: 'ponytail',
  setup: async (ctx) => {
    await ctx.command.transform((commands) => {
      for (const file of fs.readdirSync(commandDir).filter((name) => name.endsWith('.md'))) {
        const name = path.basename(file, '.md');
        const parsed = parseCommandFile(path.join(commandDir, file));
        if (!parsed) continue;
        commands.update(name, (command) => Object.assign(command, parsed));
      }
    });

    await ctx.skill.transform((skills) => {
      // V2 beta 17595 uses add(); the current documented draft uses source().
      if (typeof skills.source === 'function') {
        skills.source({ type: 'directory', path: skillsDir });
        return;
      }
      for (const skill of skillDefinitions()) skills.add(skill);
    });

    await ctx.session.hook('context', (event) => {
      const mode = getDefaultMode();
      if (mode === 'off') return;
      const instructions = getPonytailInstructions(mode);
      if (event.system.length > 0) {
        event.system[event.system.length - 1].text += '\n\n' + instructions;
      } else {
        event.system.push({ type: 'text', text: instructions });
      }
    });
  },
};
