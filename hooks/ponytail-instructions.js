#!/usr/bin/env node
// Ponytail instruction builder. skills/ponytail/SKILL.md is the single source:
// its body (sans frontmatter) is injected verbatim every turn, with {level}
// substituted and a per-level behavior line. Parsed once per process, then memoized.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./ponytail-config');

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md');

const REVIEW_LINE =
  'PONYTAIL MODE ACTIVE \u2014 level: review. Review the current diff for over-engineering; hand back a delete-list, change nothing.';

const cache = {};

function getPonytailInstructions(mode) {
  const configured = normalizePersistedMode(mode) || DEFAULT_MODE;
  if (configured === 'review') return REVIEW_LINE;
  const m = normalizeMode(configured) || DEFAULT_MODE;

  if (!cache[m]) {
    let body = '';
    try {
      // ponytail: whole file minus frontmatter is the injection; if a future
      // SKILL.md grows human-only depth sections, wrap them in markers instead
      // of growing this parser.
      const raw = fs.readFileSync(SKILL_PATH, 'utf8');
      body = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
    } catch (e) {
      // Broken install (skills/ missing): header-only so mode switching still works.
      body = 'The ladder: need it? no -> skip. Exists? reuse. Stdlib/native/installed dep covers it? use it. One line? one line. Else minimum that works. No unrequested abstractions, deps, boilerplate. Deletion over addition. Never cut validation, data-loss handling, security, accessibility.';
    }
    cache[m] = 'PONYTAIL MODE ACTIVE \u2014 level: ' + m + '\n\n'
      + body.split('{level}').join(m);
  }
  return cache[m];
}

module.exports = { getPonytailInstructions };
