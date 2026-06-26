#!/usr/bin/env node
// gavel — check that all adapter rule files are in sync with AGENTS.md
//
// Usage:
//   node scripts/check-rule-copies.js            # check Western adapters
//   node scripts/check-rule-copies.js --check-all # check all adapters (Western + Chinese)

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const checkAll = process.argv.includes('--check-all');

function read(relPath) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n').trim();
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

// Western adapters — always checked
const westernCopies = [
  ['.cursor/rules/gavel.mdc', stripFrontmatter],
  ['.windsurf/rules/gavel.md', text => text.trim()],
  ['.clinerules/gavel.md', text => text.trim()],
  ['.github/copilot-instructions.md', text => text.trim()],
  ['.kiro/steering/gavel.md', stripFrontmatter],
];

// Chinese + additional adapters — only with --check-all
const chineseCopies = [
  ['.trae/rules/gavel.md', text => text.trim()],
  ['.comate/rules/gavel.md', text => text.trim()],
  ['.lingma/rules/gavel.md', text => text.trim()],
];

const copies = checkAll ? [...westernCopies, ...chineseCopies] : westernCopies;

let failed = false;

// Check that each adapter contains the key gavel rules (case-insensitive)
const KEY_RULES = [
  'QA Ladder',
  'Test Constitution',
  'MUST DO',
  "WON'T DO",
  'Page Object',
  'Test Data',
  'accessibility',
  'factor',
  'sleep',
  'Intensity',
];

for (const [relPath, normalize] of copies) {
  const content = read(relPath);
  if (!content) {
    console.error(`MISSING: ${relPath}`);
    failed = true;
    continue;
  }

  const normalized = normalize(content);
  const lowerNormalized = normalized.toLowerCase();
  for (const rule of KEY_RULES) {
    if (!lowerNormalized.includes(rule.toLowerCase())) {
      console.error(`${relPath} is missing rule: "${rule}"`);
      failed = true;
    }
  }
}

// Verify AGENTS.md exists and contains the universal rules
const agentsContent = read('AGENTS.md');
if (!agentsContent) {
  console.error('MISSING: AGENTS.md');
  failed = true;
} else {
  const lowerAgents = agentsContent.toLowerCase();
  for (const rule of KEY_RULES) {
    if (!lowerAgents.includes(rule.toLowerCase())) {
      console.error(`AGENTS.md is missing rule: "${rule}"`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('Adapter files are out of sync. Update all adapter rule files to match the gavel QA rules.');
  process.exit(1);
}

console.log(`All ${copies.length} adapter files contain gavel QA rules. AGENTS.md verified.`);
