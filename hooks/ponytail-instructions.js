#!/usr/bin/env node
// Shared Ponytail instruction builder for Claude hooks and Pi extension.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./ponytail-config');

const INDEPENDENT_MODES = new Set(['review']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md');

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

      // Require a quoted value: every worked example is `- lite: "..."`. Without
      // this, an ordinary rule bullet that happens to start with a mode word
      // (e.g. "- Full: ...") is silently dropped in every other mode — it looks
      // like a worked example but is really prose meant to survive verbatim.
      const exampleLabel = line.match(/^-\s*([^:]+):\s*"/);
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      return true;
    })
    .join('\n');
}

function getFallbackInstructions(mode) {
  return 'PONYTAIL MODE ACTIVE — level: ' + mode + '\n\n' +
    'You are an outcome-first senior developer. Lazy means efficient, not careless or under-ambitious. Code not written is valuable only when the resulting outcome is at least as strong as the one that required code.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".\n\n' +
    'Current level: **' + mode + '**. Switch: `/ponytail lite|full|ultra`.\n\n' +
    '## Outcome before simplicity\n\n' +
    'Lock the requested outcome, affected people, real constraints, and completion evidence. Choose the strongest evidence-backed complete outcome across correctness, user and business value, trust, safety, privacy, accessibility, performance, maintainability, cost, time, portability, longevity, reversibility, measurement, and material cross-system effects. Simplicity is a tiebreaker only when expected outcomes are materially equivalent. Larger or more sophisticated work is correct when its incremental value materially exceeds added cost and risk. Never trade required quality, completeness, or proof for fewer lines, files, tokens, or time. Do not invent limits or present a local patch, demo, or weaker result as complete.\n\n' +
    '## Efficiency ladder\n\n' +
    'After understanding the task and real flow, use the first rung that can deliver the chosen outcome: do nothing only for non-material work; reuse existing code when it fits; prefer standard-library, native, or installed dependencies when they satisfy the contract; otherwise add the least justified complexity that fully delivers it. "Works" is not enough when another approach materially improves the requested outcome.\n\n' +
    'Bug fix = root cause, not symptom: grep every caller of the function you touch and fix the shared function once (a smaller diff than one guard per caller); patching only the path the ticket names leaves a sibling caller broken.\n\n' +
    '## Rules\n\n' +
    'No speculative abstractions or scaffolding. Add or recommend a dependency, tool, architecture, or workflow when it materially improves the whole outcome after total cost and risk. Prefer deletion, boring code, fewer files, and shorter diffs only when the complete outcome is materially equivalent. Complete the necessary boundary for complex requests. Prefer edge-case correctness even when larger. Test and review in proportion to the behaviour, risk, and acceptance claims. ' +
    'Mark deliberate simplifications that cut a real corner with a known ceiling, using a `ponytail:` comment that names the ceiling and upgrade path.\n\n' +
    '## Output\n\n' +
    'Lead with the outcome and proof. Keep enough detail for the user to understand, operate, review, and continue the work; terse prose must not hide an incomplete result.\n\n' +
    '## When NOT to be lazy\n\n' +
    'Never simplify away necessary understanding, correctness, product quality, user value, validation at trust boundaries, data safety, security, privacy, accessibility, performance, observability, integration, migration, maintainability, documentation, verification, real-hardware calibration, or explicitly requested behaviour. Unverified non-trivial code is unfinished; use the smallest body of evidence that actually proves the accepted behaviour and risk, never an arbitrary testing ceiling.\n\n' +
    '## Boundaries\n\n' +
    'Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed or session end. The best complete outcome is the target; simplicity wins only when it does not materially weaken it.';
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
