// ponytail — OpenCode V2 plugin adapter.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const PLUGIN_ID = 'ponytail.v2';
const CONTEXT_HOOK = 'context';
const DISABLED_MODE = 'off';
const CONFIG_DIRECTORY = 'opencode';
const STATE_FILE = '.ponytail-active';
const TEXT_ENCODING = 'utf8';
const MISSING_FILE_ERROR_CODE = 'ENOENT';
const STATE_READ_ERROR = 'ponytail: could not read mode state';

const require = createRequire(import.meta.url);
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/ponytail-config');

const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  CONFIG_DIRECTORY,
  STATE_FILE,
);

function readMode() {
  try {
    return normalizePersistedMode(fs.readFileSync(statePath, TEXT_ENCODING).trim()) || getDefaultMode();
  } catch (error) {
    if (error?.code !== MISSING_FILE_ERROR_CODE) console.error(STATE_READ_ERROR, error);
    return getDefaultMode();
  }
}

export default {
  id: PLUGIN_ID,
  setup: async (ctx) => {
    await ctx.session.hook(CONTEXT_HOOK, (event) => {
      const mode = readMode();
      if (mode !== DISABLED_MODE) event.system.push(getPonytailInstructions(mode));
    });
  },
};
