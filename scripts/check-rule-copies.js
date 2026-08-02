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
const copies = [
  ['.cursor/rules/ponytail.mdc', stripFrontmatter],
  ['.windsurf/rules/ponytail.md', text => text.trim()],
  ['.clinerules/ponytail.md', text => text.trim()],
  ['.agents/rules/ponytail.md', text => text.trim()],
  ['.qoder/rules/ponytail.md', text => text.trim()],
  ['.github/copilot-instructions.md', text => text.trim()],
  ['.kiro/steering/ponytail.md', stripFrontmatter],
];

let failed = false;

for (const [relPath, normalize] of copies) {
  const actual = normalize(read(relPath));
  if (actual !== canonical) {
    console.error(`${relPath} drifted from AGENTS.md`);
    failed = true;
  }
}

// SKILL.md is the runtime source of truth and is longer than the compact body,
// so it cannot be byte-compared. ponytail: canary, not full equality. Assert the
// load-bearing rules survive verbatim in both the source and AGENTS.md. Changing
// a rule's wording trips this, which is the reminder to propagate it everywhere.
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

const skill = read('skills/ponytail/SKILL.md');
const sources = [['skills/ponytail/SKILL.md', skill], ['AGENTS.md', agents]];
for (const phrase of INVARIANTS) {
  for (const [label, text] of sources) {
    if (!text.includes(phrase)) {
      console.error(`${label} is missing rule invariant: "${phrase}"`);
      failed = true;
    }
  }
}

// The invariants must live in the ungated core, not inside a per-level block
// (KTD4): a mode's filtered output must never silently lose a safety carve-out.
// Strip the `<!-- mode: X -->` blocks and assert each invariant is still present
// in the remaining ungated region.
const MODE_BLOCK_RE = /<!--\s*mode:\s*[a-z]+\s*-->[\s\S]*?<!--\s*\/mode:\s*[a-z]+\s*-->/gi;
const ungated = skill.replace(MODE_BLOCK_RE, '');
for (const phrase of INVARIANTS) {
  if (!ungated.includes(phrase)) {
    console.error(`skills/ponytail/SKILL.md ungated core is missing rule invariant: "${phrase}"`);
    failed = true;
  }
}

// Gated blocks must not leak into AGENTS.md or its compact copies (KTD5): the
// instruction-tier hosts load them statically with no mode state, so per-level
// blocks would be dead weight and contradict the mode-less boundary.
const GATED_BLOCK_PRESENT = /<!--\s*mode:\s*[a-z]+\s*-->|<!--\s*\/mode:\s*[a-z]+\s*-->/i;
for (const [relPath] of copies) {
  const actual = read(relPath);
  if (GATED_BLOCK_PRESENT.test(actual)) {
    console.error(`${relPath} must not contain gated mode blocks (instruction-tier copies are mode-less)`);
    failed = true;
  }
}
if (GATED_BLOCK_PRESENT.test(agents)) {
  console.error('AGENTS.md must not contain gated mode blocks (instruction-tier copies are mode-less)');
  failed = true;
}

if (failed) {
  console.error('Update the copied rule text, AGENTS.md, or SKILL.md so the shared rules match.');
  process.exit(1);
}

console.log(`Rule copies match AGENTS.md; ${INVARIANTS.length} rule invariants present in SKILL.md and AGENTS.md.`);
