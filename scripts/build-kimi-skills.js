#!/usr/bin/env node
// Generate the Kimi Code CLI skill package (.agents/skills/) from the canonical
// skills/. Kimi skills are SKILL.md files with YAML frontmatter; the body is
// copied verbatim from skills/<name>/SKILL.md so the ruleset never drifts.
//
// Run:  node scripts/build-kimi-skills.js
// tests/kimi-skills.test.js fails if the committed copies are stale.

const fs = require('fs');
const path = require('path');
const { DESCRIPTIONS } = require('./build-openclaw-skills');

const ROOT = path.join(__dirname, '..');
const HOMEPAGE = 'https://github.com/DietrichGebert/ponytail';
const NAMES = Object.keys(DESCRIPTIONS);

function sourceBody(name) {
  const src = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const fm = src.match(/^---\n[\s\S]*?\n---\n?/);
  if (!fm) throw new Error(`skills/${name}/SKILL.md has no frontmatter`);
  return src.slice(fm[0].length);
}

function render(name) {
  const desc = DESCRIPTIONS[name];
  if (desc.length > 160 || desc.includes('\n') || desc.includes('"')) {
    throw new Error(`description for ${name} must be one line, no quotes, under 160 chars`);
  }
  const frontmatter =
    `---\nname: ${name}\ndescription: "${desc}"\nhomepage: ${HOMEPAGE}\nlicense: MIT\n---\n`;
  return frontmatter + sourceBody(name);
}

function outPath(name) {
  return path.join(ROOT, '.agents', 'skills', name, 'SKILL.md');
}

module.exports = { DESCRIPTIONS, NAMES, render, outPath, sourceBody };

if (require.main === module) {
  for (const name of NAMES) {
    const p = outPath(name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, render(name));
    console.log('wrote', path.relative(ROOT, p).replace(/\\/g, '/'));
  }
}
