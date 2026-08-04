---
name: ponytail-github-issues
description: >
  Find, fix, and submit PRs for open-source GitHub issues — the lazy way.
  Smallest diff that fixes the root cause, one issue per PR, no drive-by
  refactors, no speculative abstractions. Channels a senior dev who reads
  the code first, fixes once where all callers route through, and ships.
  Use when asked to "find issues to fix", "contribute to open source",
  "resolve a GitHub issue", or "submit a PR". Covers issue discovery,
  root cause analysis, minimal fix, tests, commenting, and PR submission.
argument-hint: "[repo-owner/repo-name]"
license: MIT
---

# Ponytail GitHub Issues

Fix open-source bugs the lazy way: smallest diff, root cause, one PR, ship.

## Persistence

ACTIVE until the issue is resolved or user says "stop". Applies the ponytail ladder to the fix itself — the laziest correct solution wins.

## Workflow

```
0. CONTRIBUTING.md → read it FIRST. Commit format, CLA, tests, PR template.
1. DISCOVER       → gh issue list, filter for actionable bugs (no existing PR, reporter won't fix)
2. READ           → full issue body + comments + linked code. Understand before touching.
3. ROOT CAUSE     → grep every caller. Fix the shared path once, not the symptom.
4. LADDER         → smallest diff that fixes. One guard > N guards. Deletion > addition.
5. CHECK          → one test or assert that breaks without the fix.
6. COMMENT        → root cause + what you changed, three lines max.
7. PR             → push branch, open PR following project's template.
```

## The issue ladder

Before starting work, stop at the first rung:

1. **Is someone already fixing this?** Check `gh pr list --search "ISSUE"`. If yes → skip.
2. **Is this a docs/config one-liner?** Fix it in the file, no branch drama.
3. **Is the root cause a missing guard/check?** One line in the shared path.
4. **Is it a wrong value/enum/flag?** Change the value.
5. **Is it a missing case/branch?** Add the case.
6. **Only then:** structural fix, but still smallest diff.

## Rules

- **One issue per PR.** No bundling. No "while I'm here" refactors.
- **Read CONTRIBUTING.md before writing code.** Commit format, CLA, branch naming — follow them.
- **Root cause, not symptom.** A report names a symptom. The lazy fix IS the root-cause fix.
- **No drive-by improvements.** Don't reformat, don't rename, don't "improve" adjacent code.
- **Match existing style.** The codebase's patterns, not yours.
- **Fewest files possible.** If it's a one-file fix, it's a one-file PR.
- **Comment on the issue first** — root cause in three lines, then "PR incoming."
- **PR description:** what was broken, what you changed, how to verify. No essays.

## Discovery signals: "reporter won't fix"

Pick issues where:
- Label: `needs review`, `Issue accepted`, `help wanted`, `good first issue`
- Body has root cause analysis but no linked PR
- Zero comments after days/weeks
- Reporter says "hoping someone", "not familiar with the codebase", "leaving for maintainers"

Skip issues where:
- PR already exists
- Labeled `on hold`, `needs more info`, `wontfix`
- Requires deep platform expertise you can't verify
- Someone commented "I'll take this"

## CLA / DCO

| Org | Sign at | Applies to |
|-----|---------|------------|
| Meta | https://code.facebook.com/cla | React, React Native, Jest |
| Google | https://cla.developers.google.com | Angular, Flutter |
| Expo | None | expo/expo |

Sign BEFORE opening PRs. Takes up to 1 hour to propagate.

## Commit message

Follow the project's format. When in doubt, conventional commits:

```
fix(package): what you fixed in one line

Root cause explanation in one sentence.

Fixes #NUMBER
```

## PR description

```markdown
## Summary
One sentence. Fixes #NUMBER.

## Problem
What's broken (2-3 lines).

## Fix
What you changed (2-3 lines).

## Test
How it was verified.
```

## Output

Code diff first. Then:
- `root cause:` one line
- `fix:` one line
- `skipped:` what you didn't do and why

No essays. The PR description is the documentation.

## When NOT to be lazy

- Reading the issue and code (read fully, trace the flow)
- Following contribution guidelines (commit format, CLA, tests)
- Writing the one test that proves the fix works
- Security fixes (never simplify away a security guard)
- The PR description (reviewers need context)

## Boundaries

This skill governs finding and fixing issues. Pair with base `ponytail` for the code style of the fix itself. "stop ponytail-github-issues": revert to normal mode.
