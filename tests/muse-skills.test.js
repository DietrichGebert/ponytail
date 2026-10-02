#!/usr/bin/env node
// The Muse Code skill package (.agents/skills/) is generated from skills/ by
// scripts/build-muse-skills.js. These tests fail if the committed copies are
// stale (ruleset drift) — same pattern as openclaw-skills.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { NAMES, outPath, sourcePath } = require('../scripts/build-muse-skills');

for (const name of NAMES) {
  test(`${name}: committed Muse skill matches the generator (verbatim copy)`, () => {
    const src = fs.readFileSync(sourcePath(name), 'utf8').replace(/\r\n/g, '\n');
    const onDisk = fs.readFileSync(outPath(name), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(onDisk, src, `stale — run: node scripts/build-muse-skills.js (Muse .agents/skills/${name} drifted from skills/${name})`);
  });

  test(`${name}: Muse skill validates as Muse-compatible skill`, () => {
    const body = fs.readFileSync(outPath(name), 'utf8');
    // Light frontmatter sanity: must have name + description, and be parseable as SKILL.md
    assert.match(body, /^---\n/, 'SKILL.md must start with frontmatter ---');
    assert.match(body, /name:\s*ponytail/, `SKILL.md for ${name} must declare its name`);
    assert.match(body, /description:\s*>/, `SKILL.md for ${name} must have a description`);
  });
}

test('Muse build covers exactly the 6 canonical skills', () => {
  const srcFiles = fs.readdirSync('skills').filter(f => fs.statSync(`skills/${f}`).isDirectory()).sort();
  assert.deepEqual(NAMES.slice().sort(), srcFiles, 'Muse NAMES must list every directory in skills/');
});

test('.agents/skills directory exists and contains only generated skills', () => {
  const generated = fs.readdirSync('.agents/skills').filter(f => fs.statSync(`.agents/skills/${f}`).isDirectory()).sort();
  assert.deepEqual(generated.slice().sort(), NAMES.slice().sort(), '.agents/skills/ must contain exactly the 6 generated skills');
});
