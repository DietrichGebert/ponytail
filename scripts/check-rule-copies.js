#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8').replace(/\r\n/g, '\n').trim();
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

const agents = read('AGENTS.md');
const canonical = agents.replace(/\n\n\(Yes, this file also applies[\s\S]*?\)$/, '').trim();

// Compact copies: same body as AGENTS.md, host-specific frontmatter stripped.
// The third column is the frontmatter line that makes the host load the rule on
// every request (without it Cursor only applies the rule when @-mentioned);
// stripping hides it from the body compare, so assert it separately.
const copies = [
  ['.cursor/rules/ponytail.mdc', stripFrontmatter, 'alwaysApply: true'],
  ['.windsurf/rules/ponytail.md', text => text.trim()],
  ['.clinerules/ponytail.md', text => text.trim()],
  ['.agents/rules/ponytail.md', text => text.trim()],
  ['.qoder/rules/ponytail.md', text => text.trim()],
  ['.github/copilot-instructions.md', text => text.trim()],
  ['.kiro/steering/ponytail.md', stripFrontmatter, 'inclusion: always'],
];

let failed = false;

for (const [relPath, normalize, loadKey] of copies) {
  const text = read(relPath);
  if (normalize(text) !== canonical) {
    console.error(`${relPath} drifted from AGENTS.md`);
    failed = true;
  }
  const frontmatter = (text.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  if (loadKey && !frontmatter.split('\n').includes(loadKey)) {
    console.error(`${relPath} frontmatter is missing "${loadKey}" (the always-load key)`);
    failed = true;
  }
}

// SKILL.md is the runtime source of truth and is longer than the compact body,
// so it cannot be byte-compared. ponytail: canary, not full equality. Assert the
// load-bearing rules survive verbatim in the source, AGENTS.md, and the two
// hand-condensed fallbacks injected when SKILL.md can't be read. Changing a
// rule's wording trips this, which is the reminder to propagate it everywhere.
// Upgrade path: generate the copies from SKILL.md if this ever misses a real drift.
const INVARIANTS = [
  'in this codebase',                      // ladder rung: reuse what already exists (#217)
  'naive heuristic',                       // ceiling-comment rule
  'ONE runnable check',                    // test reflex
  'flimsier algorithm',                    // robust-variant rule
  // the four "not lazy about" safety carve-outs: pin each so a reword in either
  // file can't silently drop one. Only validation was pinned before. These are the
  // continuous substrings present in both files ("prevents data loss" because the
  // full "error handling that prevents data loss" wraps a line in SKILL.md).
  'input validation at trust boundaries',
  'prevents data loss',
  'security',
  'accessibility',
  'Lazy code without its check is unfinished', // one-check promoted to headline
];

// Hermes fallback: join _fallback_instructions' adjacent string literals so a
// phrase may wrap across source lines.
const hermesBody = (read('__init__.py').match(/^def _fallback_instructions\([\s\S]*?(?=^def )/m) || [''])[0];
const hermesFallback = (hermesBody.match(/"(?:[^"\\]|\\.)*"/g) || []).map((s) => s.slice(1, -1)).join('');

const skill = read('skills/ponytail/SKILL.md');
const sources = [
  ['skills/ponytail/SKILL.md', skill],
  ['AGENTS.md', agents],
  ['hooks/ponytail-instructions.js fallback', require('../hooks/ponytail-instructions').getFallbackInstructions('full')],
  ['__init__.py (Hermes) fallback', hermesFallback],
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
  console.error('Update the copied rule text, AGENTS.md, or SKILL.md so the shared rules match.');
  process.exit(1);
}

console.log(`Rule copies match AGENTS.md; ${INVARIANTS.length} rule invariants present in SKILL.md, AGENTS.md, and both fallbacks.`);
