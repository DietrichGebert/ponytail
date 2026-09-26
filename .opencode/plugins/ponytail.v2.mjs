// ponytail — OpenCode v2 (anomalyco/opencode >= 2.x) server plugin entry.
//
// v1 (sst/opencode, Kilo, and friends) loads `./ponytail.mjs` via `main`: a
// default-exported async function returning hooks. v2 only accepts
// `Plugin.define({ id, setup })` / `{ id, effect }` as the default export,
// so this parallel entry exposes the same behavior through v2's transform
// domains. `exports["./server"]` in package.json points v2 here; every other
// consumer keeps resolving `.` at the v1 file, untouched.
//
// `Plugin.define` is an identity function, so this file hand-rolls the
// `{ id, setup }` shape instead of importing `@opencode-ai/plugin` — one
// less runtime dependency for the same bytes on the wire.
//
// v2 platform limits (documented, not worked around):
// - No per-turn hook: the ruleset is baked into agent system prompts at
//   setup. Changing modes takes effect on reload/restart, not next message.
// - No code execution on command invoke: `/ponytail` stays a prompt template
//   (via the registered skills); the model writes the mode file itself.

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

// Marker all injected blocks start with. Checked before appending so a
// domain reload (which reruns every transform) never stacks duplicates.
const MARKER = 'PONYTAIL MODE ACTIVE';

export default {
  id: 'ponytail',
  setup: async (ctx) => {
    const mode = readMode();

    // System-prompt injection, v2 style: bake the active mode's ruleset into
    // every agent definition. Skipped entirely when off.
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

    // What the v1 `config` hook's skills-path push did: make the packaged
    // skills (and with them, their slash-command forms) visible.
    await ctx.skill.transform((skills) => {
      const dir = path.resolve(__dirname, '../../skills');
      const known = skills.list().some((s) => s.type === 'directory' && s.path === dir);
      if (!known) skills.source({ type: 'directory', path: dir });
    });
  },
};
