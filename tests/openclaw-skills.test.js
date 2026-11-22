#!/usr/bin/env node
// The OpenClaw skill package (.openclaw/skills/) is generated from skills/ by
// scripts/build-openclaw-skills.js. These tests fail if the committed copies are
// stale (ruleset drift) or if a description breaks OpenClaw's one-line <160 rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { NAMES, render, outPath, sourceBody, DESCRIPTIONS } = require('../scripts/build-openclaw-skills');

const root = path.join(__dirname, '..');
const outDir = path.join(root, '.openclaw', 'skills');

for (const name of NAMES) {
  test(`${name}: committed OpenClaw skill matches the generator`, () => {
    const onDisk = fs.readFileSync(outPath(name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(onDisk, render(name), 'stale — run: node scripts/build-openclaw-skills.js');
  });

  test(`${name}: body is the canonical skills/${name} body, verbatim`, () => {
    const onDisk = fs.readFileSync(outPath(name), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(onDisk.endsWith(sourceBody(name)), 'body drifted from skills/' + name);
  });

  test(`${name}: description is one line under 160 chars`, () => {
    const d = DESCRIPTIONS[name];
    assert.ok(d.length <= 160 && !d.includes('\n'), 'description too long or multiline');
  });
}

test('no stale generated skill dirs are committed', () => {
  const stale = fs.readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NAMES.includes(e.name))
    .map((e) => e.name);
  assert.deepEqual(stale, [], 'stale output — run: node scripts/build-openclaw-skills.js');
});

test('build removes generated dirs for skills that no longer exist', () => {
  const stale = path.join(outDir, 'ponytail-stale');
  fs.mkdirSync(stale, { recursive: true });
  fs.writeFileSync(path.join(stale, 'SKILL.md'), 'stale\n');
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-openclaw-skills.js')], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(stale), false, 'stale generated skill dir must be removed');
  } finally {
    fs.rmSync(stale, { recursive: true, force: true });
  }
});

test('publish sends only generated skills, not a stale output dir', { skip: process.platform === 'win32' }, () => {
  const stale = path.join(outDir, 'ponytail-stale');
  fs.mkdirSync(stale, { recursive: true });
  fs.writeFileSync(path.join(stale, 'SKILL.md'), 'stale\n');
  const bin = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-publish-')), 'bin');
  const log = path.join(bin, 'publish.log');
  fs.mkdirSync(bin, { recursive: true });
  const stub = path.join(bin, 'clawhub');
  fs.writeFileSync(stub, `#!/bin/sh\necho "$@" >> "${log}"\n`);
  fs.chmodSync(stub, 0o755);
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'publish-openclaw-skills.js')], {
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /ponytail-stale/, 'a stale output dir must not be published');
  } finally {
    fs.rmSync(stale, { recursive: true, force: true });
    fs.rmSync(path.dirname(bin), { recursive: true, force: true });
  }
});
