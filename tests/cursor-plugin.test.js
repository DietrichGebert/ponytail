#!/usr/bin/env node
// Smoke test for the Cursor plugin adapter: verify manifest, rules, skills,
// and OpenCode command wiring are present and consistent.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKILL_DIRS = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];
const COMMAND_FILES = [
  'ponytail.md',
  'ponytail-review.md',
  'ponytail-audit.md',
  'ponytail-debt.md',
  'ponytail-gain.md',
  'ponytail-help.md',
];

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('cursor plugin manifest exists and has required fields', () => {
  const manifest = readJSON('.cursor-plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.ok(manifest.version, 'manifest must declare a version');
  assert.ok(manifest.description, 'manifest must declare a description');
  assert.ok(manifest.author, 'manifest must declare an author');
  assert.equal(manifest.author.name, 'Dietrich Gebert');
  assert.equal(manifest.author.url, undefined, 'Cursor schema forbids author.url');
  assert.equal(manifest.displayName, undefined, 'Cursor schema forbids displayName');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.rules, './.cursor/rules/');
  assert.equal(manifest.commands, './.opencode/command/');
  assert.equal(manifest.hooks, undefined);
  assert.equal(manifest.logo, 'assets/logo.png');
});

test('cursor marketplace.json indexes this plugin at repo root', () => {
  const marketplace = readJSON('.cursor-plugin/marketplace.json');
  assert.equal(marketplace.name, 'ponytail');
  assert.ok(marketplace.owner, 'marketplace must declare an owner');
  assert.ok(Array.isArray(marketplace.plugins), 'marketplace must list plugins');
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, 'ponytail');
  assert.equal(marketplace.plugins[0].source, './');
});

test('cursor rules file exists and is non-empty', () => {
  const rulesPath = path.join(root, '.cursor', 'rules', 'ponytail.mdc');
  assert.ok(fs.existsSync(rulesPath), '.cursor/rules/ponytail.mdc must exist');
  const content = fs.readFileSync(rulesPath, 'utf8').trim();
  assert.ok(content.length > 0, '.cursor/rules/ponytail.mdc must not be empty');
  assert.ok(content.includes('lazy senior developer'), 'rules must contain the ponytail identity');
});

test('cursor manifest points at skills that actually ship', () => {
  const manifest = readJSON('.cursor-plugin/plugin.json');
  const skillsDir = path.join(root, manifest.skills);
  assert.ok(fs.existsSync(skillsDir), 'skills/ directory must exist');

  for (const skill of SKILL_DIRS) {
    const skillFile = path.join(skillsDir, skill, 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      `missing skill: skills/${skill}/SKILL.md`,
    );
  }
});

test('cursor commands dir has the six markdown command files', () => {
  const manifest = readJSON('.cursor-plugin/plugin.json');
  const commandsDir = path.join(root, manifest.commands);
  assert.ok(fs.existsSync(commandsDir), '.opencode/command/ must exist');

  for (const file of COMMAND_FILES) {
    assert.ok(
      fs.existsSync(path.join(commandsDir, file)),
      `missing command file: ${manifest.commands}${file}`,
    );
  }
});

test('cursor rules match AGENTS.md canonical body', () => {
  // Reuse the same logic as check-rule-copies.js: the .mdc copy must be
  // byte-identical to AGENTS.md minus frontmatter and the repo-self-application paragraph.
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
    .replace(/\r\n/g, '\n').trim();
  const canonical = agents.replace(/\n\n\(Yes, this file also applies[\s\S]*?\)$/, '').trim();
  const cursorCopy = fs.readFileSync(path.join(root, '.cursor', 'rules', 'ponytail.mdc'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^---\n[\s\S]*?\n---\n*/, '')
    .trim();
  assert.equal(cursorCopy, canonical, '.cursor/rules/ponytail.mdc drifted from AGENTS.md');
});
