#!/usr/bin/env node
// Goose (AAIF / Linux Foundation) loads ponytail through open conventions:
// skills discovered in ~/.agents/skills/ or .agents/skills/ (each installed
// skill becomes a slash command) plus AGENTS.md as a default context file.
// There is no manifest to ship and no host lifecycle hook to register — this
// guard pins the SKILL.md facts goose's discovery depends on, so the skills
// can't silently drift out of goose's schema.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skillsDir = path.join(root, 'skills');

test('Every skill satisfies goose SKILL.md schema requirements', () => {
  // goose requires a lowercase kebab-case name (<=64 chars) and a description.
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const frontmatter = fs.readFileSync(file, 'utf8').split('---')[1] || '';
    const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
    const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim();
    assert.ok(name, `${entry.name}/SKILL.md must declare a name`);
    assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${entry.name}: goose needs a kebab-case name`);
    assert.ok(name.length <= 64, `${entry.name}: name exceeds goose's 64-char limit`);
    assert.ok(description, `${entry.name}/SKILL.md must declare a description`);
  }
});

test('Goose install path is documented in the README', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /### Goose/);
  assert.match(readme, /\.agents\/skills/);
});
