#!/usr/bin/env node
// Build Ponytail's single ChatGPT Skill and package it as an uploadable ZIP.
// Uses Python's standard-library zipfile module so the repository needs no
// additional npm dependency just to create an archive.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHATGPT_DIR = path.join(ROOT, '.chatgpt');
const DEFAULT_ARCHIVE = path.join(ROOT, 'dist', 'ponytail-chatgpt-skill.zip');

function findPython() {
  const candidates = [
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  ];

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.prefix, '--version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status === 0) return candidate;
  }

  throw new Error('Python 3 is required to package the ChatGPT Skill');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function packageSkill(archivePath = DEFAULT_ARCHIVE) {
  run(process.execPath, [path.join(ROOT, 'scripts', 'build-chatgpt-skill.js')]);

  const output = path.resolve(archivePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.rmSync(output, { force: true });

  const python = findPython();
  run(
    python.command,
    [...python.prefix, '-m', 'zipfile', '-c', output, 'ponytail'],
    { cwd: CHATGPT_DIR },
  );

  console.log('wrote', path.relative(ROOT, output).replace(/\\/g, '/'));
  return output;
}

function outputArg(argv) {
  const index = argv.indexOf('--output');
  if (index === -1) return DEFAULT_ARCHIVE;
  if (!argv[index + 1]) throw new Error('--output requires a path');
  return path.resolve(argv[index + 1]);
}

module.exports = { CHATGPT_DIR, DEFAULT_ARCHIVE, findPython, outputArg, packageSkill };

if (require.main === module) packageSkill(outputArg(process.argv.slice(2)));
