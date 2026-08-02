#!/usr/bin/env node
// Shared Ponytail instruction builder for Claude hooks and Pi extension.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./ponytail-config');

const INDEPENDENT_MODES = new Set(['review']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md');

// Mode block markers (KTD1): `<!-- mode: lite -->` opens a block, `<!-- /mode:
// lite -->` closes it. A block whose mode is not the effective mode is dropped
// entirely; marker lines themselves are stripped from output. The `ponytail:`
// prefix is deliberately NOT used so the markers never collide with the pinned
// `ponytail:` comment convention or the debt scanner.
const MODE_BLOCK_OPEN_RE = /^<!--\s*mode:\s*([a-z]+)\s*-->\s*$/;
const MODE_BLOCK_CLOSE_RE = /^<!--\s*\/mode:\s*([a-z]+)\s*-->\s*$/;

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  const lines = withoutFrontmatter.split(/\r?\n/);
  const out = [];

  // State machine: `skip` is true while inside a mode block whose mode is not
  // the effective mode; marker lines themselves are stripped from output.
  let skip = false;

  for (const line of lines) {
    const open = line.match(MODE_BLOCK_OPEN_RE);
    if (open) {
      skip = (normalizeMode(open[1]) || open[1]) !== effectiveMode;
      continue; // strip the marker line itself
    }

    const close = line.match(MODE_BLOCK_CLOSE_RE);
    if (close) {
      skip = false;
      continue; // strip the marker line itself
    }

    if (skip) continue; // drop the whole non-active block

    // Preserve the original stateless line-drop as a fallback for content that
    // does not use blocks (KTD2): a bold table row or quoted worked example
    // whose label is a mode other than the effective one is dropped. Only the
    // intensity-table rows and worked examples are mode-specific; a bullet
    // whose label is not a mode — e.g. "No unrequested abstractions: ..." —
    // is a normal rule and must be kept verbatim.
    const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
    if (tableLabel) {
      const labelMode = normalizeMode(tableLabel[1].trim());
      if (labelMode && labelMode !== effectiveMode) continue;
    }

    // Require a quoted value: every worked example is `- lite: "..."`. Without
    // this, an ordinary rule bullet that happens to start with a mode word
    // (e.g. "- Full: ...") is silently dropped in every other mode — it looks
    // like a worked example but is really prose meant to survive verbatim.
    const exampleLabel = line.match(/^-\s*([^:]+):\s*"/);
    if (exampleLabel) {
      const labelMode = normalizeMode(exampleLabel[1].trim());
      if (labelMode && labelMode !== effectiveMode) continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

function getFallbackInstructions(mode) {
  return 'PONYTAIL MODE ACTIVE — level: ' + mode + '\n\n' +
    'You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".\n\n' +
    'Current level: **' + mode + '**. Switch: `/ponytail lite|full|ultra`.\n\n' +
    // One per-level enforcement line (R9): the failure path must not silently
    // reproduce the 96%-identical behavior the levels fix.
    'Level stance: ' + ({
      lite: 'advisory — build what is asked, name the lazier alternative, user picks.',
      ultra: 'deletion-first — YAGNI extremist, challenge the requirement before adding.',
    }[mode] || 'enforced — the ladder and rules below are binding.') + '\n\n' +
    '## The ladder\n\n' +
    'Before any code, stop at the first rung that holds (the ladder runs after you understand the problem, not instead of it — read the code it touches and trace the real flow first):\n' +
    '1. Does this need to be built at all? (YAGNI)\n' +
    '2. Does it already exist in this codebase? Reuse what is already here, do not re-write it.\n' +
    '3. Does the standard library do this? Use it.\n' +
    '4. Does a native platform feature cover it? Use it.\n' +
    '5. Does an already-installed dependency solve it? Use it.\n' +
    '6. Can this be one line? Make it one line.\n' +
    '7. Only then: write the minimum code that works.\n\n' +
    'Bug fix = root cause, not symptom: grep every caller of the function you touch and fix the shared function once (a smaller diff than one guard per caller); patching only the path the ticket names leaves a sibling caller broken.\n\n' +
    '## Rules\n\n' +
    'No abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. ' +
    'Deletion over addition. Boring over clever. Fewest files possible. ' +
    'Ship the lazy version and question the complex request in the same response — never stall. ' +
    'Between two same-size stdlib options, pick the one correct on edge cases. ' +
    'Mark deliberate simplifications that cut a real corner with a known ceiling, using a `ponytail:` comment that names the ceiling and upgrade path.\n\n' +
    '## Output\n\n' +
    'Code first. Then at most three short lines: what was skipped, when to add it. ' +
    'If the explanation is longer than the code, delete the explanation. ' +
    'Explanation the user explicitly asked for is not debt, give it in full.\n\n' +
    '## When NOT to be lazy\n\n' +
    'Never simplify away: understanding the problem (read it fully and trace the real flow before picking a rung — a small diff you do not understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, ' +
    'security measures, accessibility basics, the calibration real hardware needs (the platform is never the spec ideal), anything the user explicitly asked to keep. ' +
    'Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind (assert-based demo/self-check or one small test file; no frameworks). Trivial one-liners need no test.\n\n' +
    '## Boundaries\n\n' +
    'Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed or session end.';
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
