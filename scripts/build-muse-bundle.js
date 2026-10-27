#!/usr/bin/env node
// Generate the Muse Code native plugin bundle (muse/) from the canonical
// skills/ and hooks/. Muse requires a plugin root to contain exactly one
// nested host manifest (.muse-plugin/, .codex-plugin/, or .claude-plugin/);
// the repo root ships all three, so installing the root always reports a
// multiple-manifests diagnostic. The bundle is a self-contained plugin root
// with only .muse-plugin/, so `muse plugins install ./ponytail/muse`
// validates with zero diagnostics. Files are copied verbatim so the ruleset
// and hook logic never drift; the manifest itself lives in the bundle.
//
// Run:  node scripts/build-muse-bundle.js
// tests/muse-plugin.test.js fails if the committed copies are stale.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SKILLS = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];

// The three hook entry points in muse/.muse-plugin/plugin.json plus every
// hooks/*.js they require, spawn, or exec (ponytail-map via activate,
// ponytail-band-import via the mode tracker). Statusline scripts and the
// band board are Claude/Codex surface and stay out of the Muse bundle.
const HOOKS = [
  'ponytail-activate.js',
  'ponytail-band-import.js',
  'ponytail-config.js',
  'ponytail-instructions.js',
  'ponytail-map.js',
  'ponytail-mode-tracker.js',
  'ponytail-runtime.js',
  'ponytail-subagent.js',
];

function pairs() {
  const out = [];
  for (const name of SKILLS) {
    out.push([path.join('skills', name, 'SKILL.md'), path.join('muse', 'skills', name, 'SKILL.md')]);
  }
  for (const file of HOOKS) {
    out.push([path.join('hooks', file), path.join('muse', 'hooks', file)]);
  }
  return out;
}

module.exports = { SKILLS, HOOKS, pairs };

if (require.main === module) {
  for (const [src, dst] of pairs()) {
    const to = path.join(ROOT, dst);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, src), to);
    console.log('wrote', dst.replace(/\\/g, '/'));
  }
}
