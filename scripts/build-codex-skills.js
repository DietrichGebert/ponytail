#!/usr/bin/env node
// Generate the Codex-only skill package (.codex-plugin/skills/) from the
// canonical skills/. The ponytail entry is a small controller because Codex
// receives the active rules through lifecycle hooks. The five one-shot skills
// are copied byte for byte from their canonical sources.
//
// Run:  node scripts/build-codex-skills.js
// tests/codex-skills.test.js fails if the committed output is stale.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, '.codex-plugin', 'skills');
const ONE_SHOT_NAMES = [
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];
const NAMES = ['ponytail', ...ONE_SHOT_NAMES];

const CONTROLLER = `---
name: ponytail
description: >
  Explicitly control Ponytail mode for the current Codex thread.
  Use when the user invokes $ponytail to inspect, enable, change, or disable
  lite, full, or ultra mode, or to configure the default for future threads.
argument-hint: "[lite|full|ultra|off|default <off|lite|full|ultra>]"
license: MIT
---

# Ponytail Controller

This Codex-only skill controls Ponytail's persistent mode for the current thread.
The lifecycle hook performs the transition and supplies the authoritative instructions for the selected mode.
Do not restate or emulate the Ponytail ruleset from this controller.

## Commands

- \`$ponytail\` reports the current mode without changing it.
- \`$ponytail lite\`, \`$ponytail full\`, and \`$ponytail ultra\` select a mode for the current thread.
- \`$ponytail off\` disables Ponytail for the current thread.
- \`$ponytail default <off|lite|full|ultra>\` changes only the default for future threads.

After a mode command, follow the newest \`PONYTAIL CONTROL\` supplied by the lifecycle hook.
The one-shot review, audit, debt, gain, and help skills do not change the persistent mode.
`;

const OPENAI_CONFIG = `policy:
  allow_implicit_invocation: false
  products:
    - codex
`;

const ONE_SHOT_OPENAI_CONFIG = `policy:
  products:
    - codex
`;

// Codex always discovers <plugin_root>/skills in addition to the manifest's
// custom skill root. Product-gate the portable copies so Codex sees only the
// generated skills, while ChatGPT and Atlas can still use the portable root.
const PORTABLE_OPENAI_CONFIG = `policy:
  products:
    - chatgpt
    - atlas
`;

function canonicalPath(name) {
  return path.join(ROOT, 'skills', name, 'SKILL.md');
}

function outPath(name) {
  return path.join(OUTPUT_ROOT, name, 'SKILL.md');
}

function portableConfigPath(name) {
  return path.join(ROOT, 'skills', name, 'agents', 'openai.yaml');
}

function render(name) {
  if (name === 'ponytail') return CONTROLLER;
  if (!ONE_SHOT_NAMES.includes(name)) throw new Error(`unknown Codex skill: ${name}`);
  return fs.readFileSync(canonicalPath(name));
}

function generatedFiles() {
  const files = new Map(NAMES.map(name => [outPath(name), render(name)]));
  files.set(path.join(OUTPUT_ROOT, 'ponytail', 'agents', 'openai.yaml'), OPENAI_CONFIG);
  for (const name of ONE_SHOT_NAMES) {
    files.set(path.join(OUTPUT_ROOT, name, 'agents', 'openai.yaml'), ONE_SHOT_OPENAI_CONFIG);
  }
  return files;
}

module.exports = {
  CONTROLLER,
  NAMES,
  ONE_SHOT_NAMES,
  ONE_SHOT_OPENAI_CONFIG,
  OPENAI_CONFIG,
  OUTPUT_ROOT,
  PORTABLE_OPENAI_CONFIG,
  canonicalPath,
  generatedFiles,
  outPath,
  portableConfigPath,
  render,
};

if (require.main === module) {
  for (const name of NAMES) {
    if (fs.readFileSync(portableConfigPath(name), 'utf8') !== PORTABLE_OPENAI_CONFIG) {
      throw new Error(`skills/${name} must be excluded from Codex by agents/openai.yaml`);
    }
  }
  const files = generatedFiles();
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  for (const [file, contents] of files) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
    console.log('wrote', path.relative(ROOT, file).replace(/\\/g, '/'));
  }
}
