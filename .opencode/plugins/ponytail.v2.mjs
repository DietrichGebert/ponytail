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

// A domain reload reruns every transform, so the marker keeps appends from
// stacking duplicates.
const MARKER = 'PONYTAIL MODE ACTIVE';

export default {
  id: 'ponytail',
  setup: async (ctx) => {
    const mode = readMode();

    // Append the ruleset to every agent prompt. ponytail: v2 has no per-turn
    // hook, so the mode is frozen at setup and a switch needs a reload — same
    // flag file as v1, one step later.
    await ctx.agent.transform((agents) => {
      if (mode === 'off') return;
      const instructions = getPonytailInstructions(mode);
      for (const agent of agents.list()) {
        agents.update(agent.id, (a) => {
          if (a.system && a.system.includes(MARKER)) return;
          a.system = a.system ? a.system + '\n\n' + instructions : instructions;
        });
      }
    });

    await ctx.skill.transform((skills) => {
      const dir = path.resolve(__dirname, '../../skills');
      const known = skills.list().some((s) => s.type === 'directory' && s.path === dir);
      if (!known) skills.source({ type: 'directory', path: dir });
    });
  },
};
