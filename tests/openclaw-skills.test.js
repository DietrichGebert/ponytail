#!/usr/bin/env node
// The OpenClaw skill package (.openclaw/skills/) is generated from skills/ by
// scripts/build-openclaw-skills.js. These tests fail if the committed copies are
// stale (ruleset drift) or if a description breaks OpenClaw's one-line <160 rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { NAMES, render, outPath, sourceBody, DESCRIPTIONS } = require('../scripts/build-openclaw-skills');

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

  // The canonical source frontmatter feeds every host's skill picker; guard that
  // each carries a non-empty name and description, not just the openclaw mirror.
  test(`${name}: source frontmatter has a non-empty name and description`, () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'skills', name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const fm = src.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fm, `skills/${name}/SKILL.md has no frontmatter`);
    assert.match(fm[1], /(^|\n)name:\s*\S/, `skills/${name}: frontmatter missing a non-empty name`);
    assert.match(fm[1], /(^|\n)description:\s*\S/, `skills/${name}: frontmatter missing a non-empty description`);
  });
}
