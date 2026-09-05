#!/usr/bin/env node
// Writes and checks host rule copies from AGENTS.md. --write regenerates them.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8').replace(/\r\n/g, '\n');
}

function write(relPath, text) {
  const dest = path.join(root, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text.endsWith('\n') ? text : text + '\n');
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

function canonicalBody() {
  const agents = read('AGENTS.md').trim();
  return agents.replace(/\n\n\(Yes, this file also applies[\s\S]*?\)$/, '').trim();
}

const CURSOR_FRONT = [
  '---',
  'description: Ponytail, lazy senior dev mode. Always pick the simplest solution that works.',
  'globs:',
  'alwaysApply: true',
  '---',
  '',
  '',
].join('\n');

const KIRO_FRONT = [
  '---',
  'title: Ponytail, lazy senior dev mode',
  'inclusion: always',
  '---',
  '',
  '',
].join('\n');

const COPIES = [
  ['.cursor/rules/ponytail.mdc', body => CURSOR_FRONT + body + '\n', stripFrontmatter],
  ['.windsurf/rules/ponytail.md', body => body + '\n', text => text.trim()],
  ['.clinerules/ponytail.md', body => body + '\n', text => text.trim()],
  ['.agents/rules/ponytail.md', body => body + '\n', text => text.trim()],
  ['.qoder/rules/ponytail.md', body => body + '\n', text => text.trim()],
  ['.github/copilot-instructions.md', body => body + '\n', text => text.trim()],
  ['.kiro/steering/ponytail.md', body => KIRO_FRONT + body + '\n', stripFrontmatter],
];

const INVARIANTS = [
  'in this codebase',
  'naive heuristic',
  'ONE runnable check',
  'flimsier algorithm',
  'input validation at trust boundaries',
  'prevents data loss',
  'security',
  'accessibility',
  'Lazy code without its check is unfinished',
  'Never announce the mode',
];

function renderAll(body) {
  return COPIES.map(([relPath, render]) => [relPath, render(body)]);
}

function writeCopies() {
  const body = canonicalBody();
  for (const [relPath, text] of renderAll(body)) {
    write(relPath, text);
    console.log('wrote', relPath);
  }
}

function checkCopies() {
  const body = canonicalBody();
  let failed = false;

  for (const [relPath, render, normalize] of COPIES) {
    const actual = normalize(read(relPath));
    const expected = normalize(render(body));
    if (actual !== expected) {
      console.error(`${relPath} drifted from AGENTS.md`);
      failed = true;
    }
  }

  const skill = read('skills/ponytail/SKILL.md');
  const agents = read('AGENTS.md');
  const sources = [['skills/ponytail/SKILL.md', skill], ['AGENTS.md', agents]];
  for (const phrase of INVARIANTS) {
    for (const [label, text] of sources) {
      if (!text.includes(phrase)) {
        console.error(`${label} is missing rule invariant: "${phrase}"`);
        failed = true;
      }
    }
  }

  if (failed) {
    console.error('Run: node scripts/check-rule-copies.js --write');
    process.exit(1);
  }

  console.log(`Rule copies match AGENTS.md; ${INVARIANTS.length} rule invariants present in SKILL.md and AGENTS.md.`);
}

if (require.main === module) {
  if (process.argv.includes('--write')) writeCopies();
  checkCopies();
}

module.exports = { canonicalBody, COPIES, INVARIANTS, writeCopies, checkCopies };
