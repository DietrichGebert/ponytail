#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKILLS = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name))
  .map(entry => entry.name)
  .sort();

function install(run = spawnSync) {
  for (const name of SKILLS) {
    const result = run('muse', ['skills', 'install', `./skills/${name}`, '--scope', 'user'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

module.exports = { SKILLS, install };

if (require.main === module) process.exitCode = install();
