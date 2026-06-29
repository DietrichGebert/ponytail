#!/usr/bin/env node
// gavel — verify AGENTS.md contains all universal rules

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const agentsPath = path.join(root, 'AGENTS.md');

if (!fs.existsSync(agentsPath)) {
  console.error('MISSING: AGENTS.md');
  process.exit(1);
}

const content = fs.readFileSync(agentsPath, 'utf8');
const lowerContent = content.toLowerCase();

const REQUIRED_SECTIONS = [
  'QA Ladder',
  'Test Constitution',
  'MUST DO',
  "WON'T DO",
  'Page Object',
  'Selector Boundary',
  'selector leakage',
  'querySelector',
  'find_element',
  'Test Data',
  'Locator',
  'Assertion',
  'Workflow Routing',
  'Verification',
  'Capability',
];

let failed = false;

for (const section of REQUIRED_SECTIONS) {
  if (!lowerContent.includes(section.toLowerCase())) {
    console.error(`AGENTS.md missing section: "${section}"`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('AGENTS.md contains all required universal QA rules.');
