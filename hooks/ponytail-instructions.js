#!/usr/bin/env node
// Shared Ponytail instruction builder for Claude hooks and Pi extension.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./ponytail-config');

const INDEPENDENT_MODES = new Set(['review']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md');
const AGENTS_PATH = path.join(__dirname, '..', 'AGENTS.md');

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  // Only the intensity table rows and worked examples are mode-specific, and
  // both are keyed by a mode name (lite/full/ultra). A bullet whose label is
  // not a mode — e.g. "No unrequested abstractions: ..." — is a normal rule
  // and must be kept verbatim.
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

function getFallbackInstructions(mode) {
  const header = 'PONYTAIL MODE ACTIVE — level: ' + mode;

  try {
    const agentsMd = fs.readFileSync(AGENTS_PATH, 'utf8');
    return header + '\n\nCurrent level: **' + mode + '**. Switch: `/ponytail lite|full|ultra`.\n\n' +
      agentsMd.replace(/^# .*/, '').trim();
  } catch (_) {
    return header + '\n\nCurrent level: **' + mode + '**.\n\n' +
      'Before any code:\n' +
      '1. Does this need to be built at all? (YAGNI)\n' +
      '2. Does it already exist in this codebase? Reuse it.\n' +
      '3. Does the standard library do this? Use it.\n' +
      '4. Does a native platform feature cover it? Use it.\n' +
      '5. Does an already-installed dependency solve it? Use it.\n' +
      '6. Can this be one line? Make it one line.\n' +
      '7. Only then: write the minimum code that works.\n\n' +
      'Not lazy about: input validation at trust boundaries, error handling that prevents data loss, security, accessibility.';
  }
}

function getPonytailInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;

  if (INDEPENDENT_MODES.has(configuredMode)) {
    return 'PONYTAIL MODE ACTIVE — level: ' + configuredMode + '. Behavior defined by /ponytail-' + configuredMode + ' skill.';
  }

  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;

  try {
    return 'PONYTAIL MODE ACTIVE — level: ' + effectiveMode + '\n\n' +
      filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), effectiveMode);
  } catch (e) {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = {
  filterSkillBodyForMode,
  getFallbackInstructions,
  getPonytailInstructions,
};
