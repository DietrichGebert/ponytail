const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8').replace(/\r\n/g, '\n');
}

// The bug-fix rule has to name the owner of a wrong value, not only the shared
// function: a leaf patch (`x or default`) leaves the invalid state
// representable and the next sibling caller fails again (#1374). Every host
// copy carries the rule, so dropping it in one place is a silent drift.
const OWNER_PHRASE = 'the code that makes it';

const COPIES = [
  'AGENTS.md',
  'skills/ponytail/SKILL.md',
  'hooks/ponytail-instructions.js',
  '.agents/rules/ponytail.md',
  '.clinerules/ponytail.md',
  '.cursor/rules/ponytail.mdc',
  '.github/copilot-instructions.md',
  '.kiro/steering/ponytail.md',
  '.qoder/rules/ponytail.md',
  '.windsurf/rules/ponytail.md',
  '.openclaw/skills/ponytail/SKILL.md',
];

test('every host copy anchors a bug fix at the owner of the value', () => {
  for (const relPath of COPIES) {
    const text = read(relPath);
    assert.ok(
      text.includes(OWNER_PHRASE),
      `${relPath} is missing the owner-anchored bug-fix rule ("${OWNER_PHRASE}")`,
    );
  }
});

test('the review skill looks for a leaf patch of a state invariant', () => {
  const review = read('skills/ponytail-review/SKILL.md');
  assert.match(
    review,
    /wrong value guarded at the\s+leaf that noticed it while the code that makes it still produces it/,
  );
  const openclawReview = read('.openclaw/skills/ponytail-review/SKILL.md');
  assert.ok(
    openclawReview.includes('wrong value guarded at the'),
    '.openclaw/skills/ponytail-review/SKILL.md is missing the leaf-patch finding',
  );
});

test('the rule-copy check keeps the invariant', () => {
  const checker = read('scripts/check-rule-copies.js');
  assert.ok(
    checker.includes(OWNER_PHRASE),
    'scripts/check-rule-copies.js must pin the owner-anchored rule as an invariant',
  );
});
