#!/usr/bin/env node

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const TEMP_PREFIX = 'ponytail-opencode-v2-';
const PLUGIN_ID = 'ponytail.v2';
const CONTEXT_HOOK = 'context';
const V2_EXPORT = './.opencode/v2/ponytail.mjs';
const DEFAULT_MODE_PATTERN = /PONYTAIL MODE ACTIVE — level: full/;
const ULTRA_MODE_PATTERN = /PONYTAIL MODE ACTIVE — level: ultra/;

const tempConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
const statePath = path.join(tempConfigHome, 'opencode', '.ponytail-active');
process.env.XDG_CONFIG_HOME = tempConfigHome;
delete process.env.PONYTAIL_DEFAULT_MODE;

let plugin;
test.before(async () => {
  const pluginPath = path.join(__dirname, '..', '.opencode', 'v2', 'ponytail.mjs');
  plugin = (await import(pathToFileURL(pluginPath))).default;
});

async function setupPlugin() {
  let contextHook;
  await plugin.setup({
    session: {
      hook: async (name, callback) => {
        assert.equal(name, CONTEXT_HOOK);
        contextHook = callback;
      },
    },
  });
  return contextHook;
}

test('V2 adapter registers a unique plugin and injects the persisted mode', async () => {
  const packageManifest = require('../package.json');
  assert.equal(packageManifest.exports['./v2'], V2_EXPORT);
  assert.equal(plugin.id, PLUGIN_ID);
  const contextHook = await setupPlugin();

  const defaultContext = { system: [] };
  await contextHook(defaultContext);
  assert.equal(defaultContext.system.length, 1);
  assert.match(defaultContext.system[0], DEFAULT_MODE_PATTERN);

  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, 'ultra');
  const ultraContext = { system: ['Existing instructions'] };
  await contextHook(ultraContext);
  assert.equal(ultraContext.system.length, 2);
  assert.match(ultraContext.system[1], ULTRA_MODE_PATTERN);

  fs.writeFileSync(statePath, 'off');
  const offContext = { system: [] };
  await contextHook(offContext);
  assert.deepEqual(offContext.system, []);
});

test.after(() => fs.rmSync(tempConfigHome, { recursive: true, force: true }));
