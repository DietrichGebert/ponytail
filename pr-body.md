### Summary

The bug-fix rule only covers **shared functions**:

> *"Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code."*

It says nothing about **data/state invariants**. When an unexpected value (`None`, a negative amount, an unnormalized string) breaks a leaf caller, agents optimizing for *"the shortest working diff wins"* and *"fewest files possible"* converge on a callsite patch (`val or default`, `if not x: return`):

1. the leaf diff is minimal (+1 line in 1 file),
2. the invalid state stays representable across the rest of the codebase,
3. sibling callers fail in later rounds — the "whack-a-mole" review loop.

Anchoring the rule at the **authoritative owner** of the value (the constructor, parser, schema or ingestion point) fixes the contract once and front-loads the blast radius.

### What changed

- **`AGENTS.md`, `skills/ponytail/SKILL.md`, `hooks/ponytail-instructions.js`** and every host copy of the rule (`.cursor/rules/ponytail.mdc`, `.windsurf`, `.clinerules`, `.agents`, `.qoder`, `.github/copilot-instructions.md`, `.kiro/steering`, `.openclaw/skills/ponytail/SKILL.md`) now read:

  > *Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code. **A wrong value belongs to the code that makes it (the constructor, parser, schema or ingestion point): fix it there, not with a default at the leaf that noticed it.***

- **`skills/ponytail-review/SKILL.md`** (and the regenerated `.openclaw` copy) also look for the leaf patch in the diff: *"a wrong value guarded at the leaf that noticed it while the code that makes it still produces it."*
- **`scripts/check-rule-copies.js`** pins the new wording as a rule invariant, so a reword in one copy cannot silently drop the rule.

### Tests

- New `tests/owner-anchored-fixes.test.js` — 3 tests: every host copy carries the owner-anchored rule, the review skill looks for the leaf patch, and the rule-copy check keeps the invariant.
- `node --test tests/owner-anchored-fixes.test.js` → 3 pass, 0 fail.
- `node scripts/check-rule-copies.js` → *Rule copies match AGENTS.md; 11 rule invariants present in SKILL.md and AGENTS.md.*
- `node scripts/build-openclaw-skills.js` → the `.openclaw` copies are regenerated from `skills/`.
- `npm test` → 144 pass, 1 fail: `csv: timeout can be raised for slow pandas startup`, which fails identically on the unmodified branch in this environment (a known Windows pandas-startup timeout flake).

Closes #1374
