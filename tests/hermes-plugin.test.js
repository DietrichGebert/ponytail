#!/usr/bin/env node
// Hermes plugin tests. Includes quote-guard filter parity and review-not-default.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const commands = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];
const skillCommands = commands.filter((name) => name !== 'ponytail');

const root = path.join(__dirname, '..');

// ponytail: probe once; on Windows `python3` is the Store-alias stub that fails
// even when Python is installed, so fall back to `python` (mirrors benchmarks/correctness.js).
let pythonCmd;
function pythonExe() {
  if (pythonCmd) return pythonCmd;
  for (const cmd of ['python3', 'python']) {
    if (spawnSync(cmd, ['-c', 'import sys'], { encoding: 'utf8' }).status === 0) {
      return (pythonCmd = cmd);
    }
  }
  return (pythonCmd = 'python3');
}

function python(script, env = {}) {
  const result = spawnSync(pythonExe(), ['-c', script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`python failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

test('Hermes plugin manifest matches runtime skills, hooks, commands, and package version', () => {
  const manifestPath = path.join(root, 'plugin.yaml');
  assert.ok(fs.existsSync(manifestPath), 'missing root plugin.yaml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const skillDirs = fs.readdirSync(path.join(root, 'skills'))
    .filter((name) => fs.existsSync(path.join(root, 'skills', name, 'SKILL.md')))
    .sort();

  assert.match(manifest, /^name:\s*ponytail$/m);
  assert.match(manifest, new RegExp('^version: *' + packageJson.version + '$', 'm'));
  assert.match(manifest, new RegExp('^author: *' + packageJson.author.name + '$', 'm'));
  assert.deepEqual(commands.filter((name) => manifest.includes(`  - ${name}`)), commands);
  assert.deepEqual(skillDirs.filter((name) => manifest.includes(`  - ${name}`)), skillDirs);
  assert.match(manifest, /pre_llm_call/);
  assert.match(manifest, /pre_gateway_dispatch/);
});
