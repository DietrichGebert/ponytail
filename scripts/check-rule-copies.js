#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { compactBody, renderCopies } = require('./generate-rule-copies');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8').replace(/\r\n/g, '\n');
}

let failed = false;

const expected = renderCopies();
for (const [relPath, content] of Object.entries(expected)) {
  const actual = read(relPath);
  if (actual !== content) {
    console.error(`${relPath} is stale — run: node scripts/generate-rule-copies.js`);
    failed = true;
  }
}

// SKILL.md is the hand-edited source. Pin load-bearing rules so a reword cannot
// silently drop one from the skill (or from the compact body derived from it).
const INVARIANTS = [
  'in this codebase',                      // ladder rung: reuse what already exists (#217)
  'grep every caller',                     // root-cause bug fix (#245)
  'never about the change itself',         // scope: callers, tests and fixtures the change breaks
  'shortcut: <the limit>, <when to upgrade>',   // shortcut marker comment
  'correct on edge cases',                 // robust-variant rule
  'Lazy code without its check is unfinished', // test reflex
  // the "never cut" carve-outs: pin each so a reword can't silently drop one.
  'validation at trust boundaries',
  'prevents data loss',
  'security',
  'accessibility',
];

const skill = read('skills/ponytail/SKILL.md');
const compact = compactBody();
const sources = [
  ['skills/ponytail/SKILL.md', skill],
  ['compact body (AGENTS.md)', compact],
];
for (const phrase of INVARIANTS) {
  for (const [label, text] of sources) {
    if (!text.includes(phrase)) {
      console.error(`${label} is missing rule invariant: "${phrase}"`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('Update skills/ponytail/SKILL.md, then run: node scripts/generate-rule-copies.js');
  process.exit(1);
}

console.log(
  `Rule copies match SKILL.md generator; ${INVARIANTS.length} rule invariants present in skill and compact body.`,
);
