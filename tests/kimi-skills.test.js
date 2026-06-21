#!/usr/bin/env node
// The Kimi Code CLI skill package (.agents/skills/) is generated from skills/ by
// scripts/build-kimi-skills.js. These tests fail if the committed copies are
// stale or if a description breaks the one-line <160 rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { NAMES, render, outPath, sourceBody, DESCRIPTIONS } = require('../scripts/build-kimi-skills');

for (const name of NAMES) {
  test(`${name}: committed Kimi skill matches the generator`, () => {
    const onDisk = fs.readFileSync(outPath(name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(onDisk, render(name), 'stale — run: node scripts/build-kimi-skills.js');
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
