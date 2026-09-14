#!/usr/bin/env node
// Generate Muse Code project skills (.agents/skills/) from canonical skills/.
// Muse Code discovers project skills at `.agents/skills/<id>/SKILL.md` when the
// workspace is trusted (`muse --trust-workspace`), and reads `AGENTS.md` as
// always-on rules. The SKILL.md format for Muse is identical to the canonical
// `skills/` (agent-skills-common-subset: name + description frontmatter), so
// we copy verbatim — no frontmatter rewrite like OpenClaw needs.
//
// This keeps a single source of truth in `skills/` and makes `.agents/skills/`
// a generated artifact, preventing drift where an edit to `skills/ponytail/`
// would otherwise leave the Muse copy stale.
//
// Run:  node scripts/build-muse-skills.js
// tests/muse-skills.test.js fails if the committed copies are stale.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const NAMES = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

function sourcePath(name) {
  return path.join(ROOT, 'skills', name, 'SKILL.md');
}

function outPath(name) {
  return path.join(ROOT, '.agents', 'skills', name, 'SKILL.md');
}

function build() {
  for (const name of NAMES) {
    const src = sourcePath(name);
    const dst = outPath(name);
    const body = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, body.replace(/\r\n/g, '\n'));
    console.log('wrote', path.relative(ROOT, dst).replace(/\\/g, '/'));
  }
}

module.exports = { NAMES, sourcePath, outPath, build };

if (require.main === module) {
  build();
}
