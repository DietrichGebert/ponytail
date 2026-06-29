#!/usr/bin/env node
// Shared Graybeard instruction builder for Claude hooks and Pi extension.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./graybeard-config');
const { getStackContext } = require('./graybeard-stack');

const INDEPENDENT_MODES = new Set(['review']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'graybeard', 'SKILL.md');

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
      if (tableLabel) {
        const labelMode = normalizeMode(tableLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      const exampleLabel = line.match(/^-\s*([^:]+):\s*/);
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      return true;
    })
    .join('\n');
}

function withStackContext(text) {
  return text + '\n\n## Stack Context\n\n' + getStackContext(process.cwd());
}

function getFallbackInstructions(mode) {
  return withStackContext('GRAYBEARD MODE ACTIVE — level: ' + mode + '\n\n' +
    'You are the senior engineer in the room. Inspect the repo stack first, use established framework patterns, keep scope tight, and require focused automated proof for behavior changes.\n\n' +
    'Read local instructions and manifests before advising. Prefer existing repo patterns, framework-native features, database constraints, standard libraries, and already-installed dependencies before custom code. Do not add abstractions, dependencies, config, or background machinery unless the current requirement earns them.\n\n' +
    'Never compromise trust-boundary validation, data integrity, security, accessibility, rollback safety, or requested behavior. Ask only when product intent or a real tradeoff is unclear.');
}

function getGraybeardInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;

  if (INDEPENDENT_MODES.has(configuredMode)) {
    return withStackContext('GRAYBEARD MODE ACTIVE — level: ' + configuredMode + '. Behavior defined by /graybeard-' + configuredMode + ' skill.');
  }

  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;

  try {
    return withStackContext('GRAYBEARD MODE ACTIVE — level: ' + effectiveMode + '\n\n' +
      filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), effectiveMode));
  } catch (e) {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = {
  filterSkillBodyForMode,
  getFallbackInstructions,
  getGraybeardInstructions,
};
