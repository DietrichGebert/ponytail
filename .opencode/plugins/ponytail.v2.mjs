// ponytail — OpenCode v2 plugin entry.
//
// v2 loads this instead of ./ponytail.mjs: it wants a default export of
// { id, setup } and rejects v1's hook factory with PluginModule.LoadError.
// package.json points exports["./server"] here; "." still serves the v1 file,
// so v1 loaders see no change.
//
// Plugin.define is an identity function, so the shape is hand-rolled rather
// than importing @opencode-ai/plugin.

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
const { parseSkillFile } = require('./ponytail-frontmatter.cjs');

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

// ponytail: a domain reload rebuilds the draft from scratch, so a transform
// never sees its own previous output. The marker only guards a double
// registration (plugin listed twice in config), which would otherwise
// concatenate the ruleset twice.
const MARKER = 'PONYTAIL MODE ACTIVE';

export default {
  id: 'ponytail',
  setup: async (ctx) => {
    const mode = readMode();

    // Frozen for the process: v2 has no per-turn hook and no command-execute
    // callback, so a level switch needs a restart. Instructions are built once
    // here rather than per reload, since the mode cannot change underneath us.
    const instructions = mode === 'off' ? undefined : getPonytailInstructions(mode);

    // v2 runs this after its built-in agent plugin, so these append to the
    // existing prompts instead of replacing them (verified on 2.0.18: the
    // draft already carries explore/title/summary prompts when we see it).
    await ctx.agent.transform((agents) => {
      if (!instructions) return;
      for (const agent of agents.list()) {
        agents.update(agent.id, (a) => {
          if (a.system && a.system.includes(MARKER)) return;
          a.system = a.system ? a.system + '\n\n' + instructions : instructions;
        });
      }
    });

    // v2's skill draft takes resolved skills, not directories, so read each
    // packaged SKILL.md and hand over { id, name, description, path, content }.
    // That also gives the `/ponytail` slash commands, which v2 derives from
    // skills rather than from a command directory.
    await ctx.skill.transform((skills) => {
      const dir = path.resolve(__dirname, '../../skills');
      let files = [];
      try {
        files = fs.readdirSync(dir).filter((name) => fs.existsSync(path.join(dir, name, 'SKILL.md')));
      } catch (e) {
        return;
      }
      for (const name of files) {
        const file = path.join(dir, name, 'SKILL.md');
        let parsed;
        try {
          parsed = parseSkillFile(file);
        } catch (e) {
          continue;
        }
        if (!parsed) continue;
        skills.add({ id: name, name, description: parsed.description, path: file, content: parsed.body });
      }
    });
  },
};
