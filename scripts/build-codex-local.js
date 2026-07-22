#!/usr/bin/env node
// Build the Codex skill package, then install this checkout through a local
// Codex marketplace so global Codex loads local changes instead of GitHub main.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MARKETPLACE_NAME = 'ponytail-local';
const MARKETPLACE_ROOT = path.join(ROOT, '.codex-local-marketplace');
const PLUGIN_SOURCE = './plugins/ponytail';

function localMarketplace() {
  return {
    name: MARKETPLACE_NAME,
    interface: { displayName: 'Ponytail Local' },
    plugins: [
      {
        name: 'ponytail',
        source: {
          source: 'local',
          path: PLUGIN_SOURCE,
        },
        policy: {
          installation: 'AVAILABLE',
          authentication: 'ON_INSTALL',
        },
        category: 'Productivity',
      },
    ],
  };
}

function writeLocalMarketplace(root = ROOT, marketplaceRoot = MARKETPLACE_ROOT) {
  const pluginPath = path.join(marketplaceRoot, 'plugins', 'ponytail');
  const file = path.join(marketplaceRoot, '.agents', 'plugins', 'marketplace.json');
  fs.rmSync(pluginPath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.symlinkSync(root, pluginPath, process.platform === 'win32' ? 'junction' : 'dir');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(localMarketplace(), null, 2) + '\n');
  return file;
}

function run(command, args, options = {}) {
  console.log(`> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...options,
  });
  if (result.status === 0) return;
  if (options.optional) return;
  throw new Error(`${command} ${args.join(' ')} failed`);
}

function main() {
  run(process.execPath, [path.join(ROOT, 'scripts', 'build-codex-skills.js')]);
  writeLocalMarketplace();

  run('codex', ['plugin', 'remove', `ponytail@${MARKETPLACE_NAME}`], { optional: true });
  run('codex', ['plugin', 'remove', 'ponytail@ponytail'], { optional: true });
  run('codex', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME], { optional: true });
  run('codex', ['plugin', 'marketplace', 'add', MARKETPLACE_ROOT]);
  run('codex', ['plugin', 'add', `ponytail@${MARKETPLACE_NAME}`]);

  console.log('\nInstalled local Ponytail for Codex from:');
  console.log(ROOT);
  console.log('Restart Codex, open /hooks, trust the hooks, then start a new thread.');
}

module.exports = {
  MARKETPLACE_NAME,
  MARKETPLACE_ROOT,
  PLUGIN_SOURCE,
  localMarketplace,
  writeLocalMarketplace,
};

if (require.main === module) main();
