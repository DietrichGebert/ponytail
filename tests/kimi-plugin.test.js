#!/usr/bin/env node
// Smoke test for the Kimi Code plugin adapter: verify manifest, rules, and skills
// wiring are present and consistent.

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

function readJSON(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

test('kimi plugin manifest exists and has required fields', () => {
  const manifest = readJSON('.kimi-plugin/plugin.json');
  assert.equal(manifest.name, 'ponytail');
  assert.ok(manifest.version, 'manifest must declare a version');
  assert.ok(manifest.description, 'manifest must declare a description');
  assert.ok(manifest.author, 'manifest must declare an author');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.skills, './skills/');
  assert.ok(Array.isArray(manifest.hooks), 'hooks must be an array');
  assert.equal(manifest.hooks.length, 3);
  
  // Verify registered hooks
  const events = manifest.hooks.map(h => h.event);
  assert.ok(events.includes('SessionStart'));
  assert.ok(events.includes('SubagentStart'));
  assert.ok(events.includes('UserPromptSubmit'));

  const activateHook = manifest.hooks.find(h => h.event === 'SessionStart');
  assert.equal(activateHook.command, 'node ./hooks/ponytail-activate.js');
  assert.equal(activateHook.matcher, 'startup|resume|clear|compact');
  assert.equal(activateHook.timeout, 5);

  const subagentHook = manifest.hooks.find(h => h.event === 'SubagentStart');
  assert.equal(subagentHook.command, 'node ./hooks/ponytail-subagent.js');
  assert.equal(subagentHook.timeout, 5);

  const trackerHook = manifest.hooks.find(h => h.event === 'UserPromptSubmit');
  assert.equal(trackerHook.command, 'node ./hooks/ponytail-mode-tracker.js');
  assert.equal(trackerHook.timeout, 5);
});

test('kimi manifest points at skills that actually ship', () => {
  const manifest = readJSON('.kimi-plugin/plugin.json');
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

test('kimi runtime environment detection works', () => {
  const { isKimi } = require('../hooks/ponytail-runtime');
  // isKimi is false in test process as KIMI_PLUGIN_ROOT / KIMI_CODE_HOME are unset
  assert.equal(isKimi, false);
});
