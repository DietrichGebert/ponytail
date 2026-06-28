#!/usr/bin/env node
// gavel — verify all expected skill SKILL.md files exist

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skillsDir = path.join(root, 'skills');

const EXPECTED_SKILLS = [
  'gavel',
  'gavel-review',
  'gavel-audit',
  'gavel-debt',
  'gavel-gain',
  'gavel-help',
  'gavel-detect',
  'gavel-playwright',
  'gavel-selenium',
  'gavel-cypress',
  'gavel-webdriverio',
  'gavel-cucumber',
  'gavel-plan',
  'gavel-e2e',
  'gavel-api',
  'gavel-run',
  'gavel-analyze',
  'gavel-bug',
  'gavel-triage',
  'gavel-close',
  'gavel-env',
  'gavel-auth',
  'gavel-hub',
  'gavel-ci',
  'gavel-heal',
  'gavel-flake',
  'gavel-init',
];

const EXPECTED_AGENTS = [
  'gavel-orchestrator',
  'gavel-generator',
  'gavel-healer',
  'gavel-api-specialist',
  'gavel-impact',
  'gavel-fail-audit',
  'gavel-refactor',
];

let failed = false;

// Check skills
for (const skill of EXPECTED_SKILLS) {
  const skillPath = path.join(skillsDir, skill, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    console.error(`MISSING: skills/${skill}/SKILL.md`);
    failed = true;
  }
}

// Check agents
const agentsDir = path.join(root, 'agents');
for (const agent of EXPECTED_AGENTS) {
  const agentPath = path.join(agentsDir, `${agent}.md`);
  if (!fs.existsSync(agentPath)) {
    console.error(`MISSING: agents/${agent}.md`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`All ${EXPECTED_SKILLS.length} skills and ${EXPECTED_AGENTS.length} agents verified.`);
