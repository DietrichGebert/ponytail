#!/usr/bin/env node
// Regression test for #1358. /ponytail-review marked a live Pydantic config
// flag dead because it checked one call site and missed another:
//
//   class ParentResponse(BaseModel):
//       model_config = ConfigDict(from_attributes=True)
//       periods: list[PeriodResponse] = []
//
//   ParentResponse.model_validate(entity.model_dump())  # dict: flag unused
//   ParentResponse.model_validate(entity)              # ORM object: flag live
//
// Removing from_attributes=True from the nested PeriodResponse broke the
// second call site at runtime. The review/audit skills are prompts, so the
// fix is a rule in the shipped text: check every use of the owner before
// calling anything dead, and mark the finding unverified when you cannot.
// These tests fail if any shipped copy loses that rule.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// The canonical skill, the generated OpenClaw copy, and both command adapters
// that hosts actually invoke. A rule only in one of them still ships the bug
// on the other hosts.
const COPIES = [
  ['review skill', 'skills/ponytail-review/SKILL.md'],
  ['review OpenClaw skill', '.openclaw/skills/ponytail-review/SKILL.md'],
  ['review Claude/Gemini command', 'commands/ponytail-review.toml'],
  ['review OpenCode command', '.opencode/command/ponytail-review.md'],
  ['audit skill', 'skills/ponytail-audit/SKILL.md'],
  ['audit OpenClaw skill', '.openclaw/skills/ponytail-audit/SKILL.md'],
  ['audit Claude/Gemini command', 'commands/ponytail-audit.toml'],
  ['audit OpenCode command', '.opencode/command/ponytail-audit.md'],
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

for (const [label, rel] of COPIES) {
  test(`#1358 ${label}: deletion checks every use, not one call site`, () => {
    const text = read(rel);
    assert.match(text, /every use\s+of\s+(its|the)\s+owner/i,
      `${rel} lost the every-use rule; one call site can miss a live ORM/serialization path`);
    assert.match(text, /not one call\s+site/i,
      `${rel} must reject one-call-site proof for a deletion`);
  });

  test(`#1358 ${label}: names the Pydantic from_attributes failure`, () => {
    const text = read(rel);
    assert.match(text, /from_attributes/i,
      `${rel} must name the repro (Pydantic from_attributes=True)`);
    assert.match(text, /validates an (ORM )?object/i,
      `${rel} must say the flag is live when a call site validates an object`);
  });

  test(`#1358 ${label}: unverified deletions are not recommended`, () => {
    const text = read(rel);
    assert.match(text, /unverified/i,
      `${rel} must offer the unverified escape hatch`);
    assert.match(text, /do not recommend\s+deleting/i,
      `${rel} must not recommend deleting what it could not verify`);
  });
}
