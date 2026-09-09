// @ts-check

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Plugin, Skill } from '@opencode/plugin';
import { Schema } from 'effect';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { getDefaultMode, normalizeMode } = require('../../hooks/ponytail-config');
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { parseCommandFile } = require('../plugins/ponytail-frontmatter.cjs');

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
    return [Schema.decodeUnknownSync(Skill.Info)({ id: name, name, description, location, content: match[2].trim() })];
  });
}

/** @param {string} template @param {string} input */
function expandCommandTemplate(template, input) {
  const expanded = template.replaceAll('$ARGUMENTS', () => input);
  return !template.includes('$ARGUMENTS') && input.trim()
    ? `${expanded}\n\n${input}`.trim()
    : expanded.trim();
}

/** @template {{ mention?: unknown }} T @param {readonly T[]} [references] */
function withoutMentions(references) {
  return (references || []).map(({ mention, ...reference }) => reference);
}

export default Plugin.define({
  id: 'ponytail',
  setup: async (ctx) => {
    const definitions = fs.readdirSync(commandDir).filter((name) => name.endsWith('.md')).flatMap((file) => {
      const parsed = parseCommandFile(path.join(commandDir, file));
      return parsed ? [{ name: path.basename(file, '.md'), ...parsed }] : [];
    });
    const bundledSkills = skillDefinitions();
    /** @param {string} sessionID */
    const readMode = async (sessionID) => normalizeMode(await ctx.storage.get(`mode/${sessionID}`)) || getDefaultMode();

    await ctx.command.transform((commands) => {
      for (const { name, description, template } of definitions) {
        commands.add({
          name,
          description,
          execute: async ({ sessionID, prompt, delivery }) => {
            let text = expandCommandTemplate(template, prompt.text);
            if (name === 'ponytail') {
              const argument = prompt.text.trim();
              const mode = normalizeMode(argument);
              if (mode) await ctx.storage.set(`mode/${sessionID}`, mode);
              const status = `Ponytail level: ${await readMode(sessionID)}.`;
              text = argument && !mode
                ? `Invalid Ponytail level. Use lite, full, ultra, or off. ${status} Report this without changing the mode.`
                : `${status} Report this status briefly. The plugin controls the mode for this session.`;
            }
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text,
              files: withoutMentions(prompt.files),
              agents: withoutMentions(prompt.agents),
              skills: withoutMentions(prompt.skills),
              delivery,
            });
          },
        });
      }
    });

    await ctx.skill.transform((skills) => {
      for (const skill of bundledSkills) skills.add(skill);
    });

    await ctx.session.hook('context', async (event) => {
      const mode = await readMode(event.sessionID);
      if (mode === 'off') return;
      const instructions = getPonytailInstructions(mode);
      if (event.system.length > 0) {
        const last = event.system.length - 1;
        event.system[last] = { ...event.system[last], text: event.system[last].text + '\n\n' + instructions };
      } else {
        event.system.push({ type: 'text', text: instructions });
      }
    });
  },
});
