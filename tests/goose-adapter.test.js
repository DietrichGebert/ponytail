#!/usr/bin/env node
// Goose (AAIF / Linux Foundation) loads ponytail as an Open Plugins-format
// plugin: `goose plugin install <this repo>` clones the repo, detects the
// plugin.json manifest plus the skills/ tree, and imports each skill as a
// namespaced slash command. Verified live against goose v1.52.0. AGENTS.md
// doubles as the always-on rules carrier (goose default context file), and
// no host lifecycle hook is registered. This guard pins the facts goose's
// discovery depends on so the skills and manifest can't silently drift.

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

test('The root manifest carries the fields goose plugin install reports', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ponytail');
  assert.equal(typeof manifest.description, 'string');
  assert.ok(manifest.description.length > 0, 'plugin.json description must be non-empty');
  // Version is deliberately absent: check-versions.js pins exactly eight
  // files, and goose reports "unknown" without breaking the import.
  assert.equal(manifest.hooks, undefined);
  assert.equal(manifest.mcpServers, undefined);
});

test('Goose install path is documented in the README', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /### Goose/);
  assert.match(readme, /goose plugin install/);
  assert.match(readme, /\.agents\/skills/);
});
