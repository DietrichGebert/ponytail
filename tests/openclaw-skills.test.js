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
}

// Leak test (KTD5/R10): the raw SKILL.md and its verbatim OpenClaw copy carry
// the union of core + per-level blocks. Every `<!-- mode: X -->` open marker
// must be balanced by a matching `<!-- /mode: X -->` close — an unclosed or
// stray marker would leak into raw consumers (OpenClaw, pi skills, skill
// pickers, benchmark arms) as instructions.
test('ponytail: gated mode blocks are balanced and well-formed in the raw copies', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md'), 'utf8');
  const openclaw = fs.readFileSync(outPath('ponytail'), 'utf8');

  for (const [label, text] of [['skills/ponytail/SKILL.md', skill], ['.openclaw/skills/ponytail/SKILL.md', openclaw]]) {
    const opens = [...text.matchAll(/<!--\s*mode:\s*([a-z]+)\s*-->/g)].map((m) => m[1]);
    const closes = [...text.matchAll(/<!--\s*\/mode:\s*([a-z]+)\s*-->/g)].map((m) => m[1]);

    assert.ok(opens.length > 0, `${label} must carry gated mode blocks`);
    assert.equal(closes.length, opens.length, `${label} must have balanced mode markers`);
    for (const m of opens) {
      assert.ok(['lite', 'full', 'ultra'].includes(m), `${label} has an unknown mode marker: ${m}`);
    }
    for (const m of closes) {
      assert.ok(opens.includes(m), `${label} has a close marker without a matching open: ${m}`);
    }
  }
});
