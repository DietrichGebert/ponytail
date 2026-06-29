# Integration Patterns

How to use ponytail alongside other tools, frameworks, and multi-agent
workflows. This guide covers the "one voice among many" integration model —
where ponytail is a specialist skill, not a project governor.

## On-demand profile

For projects with their own rules, test policies, or multi-agent review systems:

- **Install skills, not the always-on rule.** Use `ponytail-review`,
  `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, and `ponytail-help` as
  pull-based tools invoked when needed — not the core `ponytail` skill with
  its `ACTIVE EVERY RESPONSE` persistence.
- **Use `ponytail-playbook`** (if available) for implementation guidance that
  defers test policy to the host project's framework.
- **No SessionStart hooks** in this profile. The hook system (`hooks/`) is
  designed for always-on activation — skip it for on-demand use.

## Anti-patterns

### Double injection

Installing ponytail as both a Cursor skill AND a project rule (`.cursor/rules/ponytail.mdc`)
injects the instructions twice per turn. This doubles token cost and can
produce conflicting guidance when the two copies drift.

**Fix:** Choose one delivery mechanism. For on-demand use, install individual
skills. For always-on use, use the rule file — not both.

### Ultra as routine council member

In multi-agent review setups (multiple independent reviewers), adding
`ponytail-ultra` as a permanent 4th reviewer adds ~33% cost with ~75% overlap
with any existing simplify/complexity reviewer.

**When ultra IS appropriate:** On-demand, when reviewer judgment suggests the
*problem itself* may be wrong — "should this feature exist?" is ultra's
natural question, not "is this implementation clean?"

### Standalone review as QA gate

`ponytail-review` is scoped to over-engineering only. Using it as the sole
code review gate misses correctness bugs, security holes, and performance
issues. Always pair with dedicated reviewers for those concerns.

## Multi-agent review integration

The recommended pattern is **enhancing an existing complexity/simplify lens**
with ponytail-review's structured output format, not adding a separate lens:

1. Keep your existing review lenses (correctness, architecture, simplify)
2. Add ponytail-review's tag format (`delete:`, `stdlib:`, `native:`, `yagni:`,
   `shrink:`) as structured output guidance for the simplify lens
3. Keep free-form structural observations alongside the tags

This preserves signal density gains without the cost of an additional reviewer.

## Skill inventory for on-demand use

| Skill | When to invoke | What you get |
|-------|----------------|-------------|
| `ponytail-review` | Reviewing diffs for over-engineering | Tagged findings + net-lines metric |
| `ponytail-audit` | Periodic repo health check | Ranked findings across the codebase |
| `ponytail-debt` | Tracking deliberate simplifications | Ledger of `ponytail:`/`defer:` comments |
| `ponytail-gain` | Curiosity about benchmark claims | Published scoreboard with caveats |
| `ponytail-help` | Quick reference | Levels, skills, config, update |
| `ponytail-playbook` | Implementation mode (TDD-compatible) | Ladder + deferred test policy |
