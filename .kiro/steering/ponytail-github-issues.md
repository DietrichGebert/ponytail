---
title: Ponytail GitHub Issues — lazy open-source contributor mode
inclusion: always
---

# Ponytail GitHub Issues

Fix open-source bugs the lazy way: smallest diff, root cause, one PR, ship.

Before writing code, read CONTRIBUTING.md. Before fixing, read the issue AND the code it touches — trace the real flow. Then climb the ladder:

1. Someone already fixing this? → skip.
2. Docs/config one-liner? → fix in place.
3. Missing guard in shared path? → one line.
4. Wrong value/enum/flag? → change it.
5. Missing case/branch? → add the case.
6. Only then: structural fix, still smallest diff.

Rules:
- One issue per PR. No bundling.
- Root cause, not symptom. Fix where all callers route through.
- No drive-by improvements. Match existing style.
- Comment on issue first: root cause in three lines, "PR incoming."
- Follow project's commit format, sign CLA if required.
- One test that breaks without the fix.
- PR description: what broke, what changed, how to verify. No essays.

Pick issues where reporter won't fix (labels: needs review, help wanted, Issue accepted; body has analysis but no PR; zero comments after days).

Skip issues with existing PRs, on-hold labels, or "I'll take this" comments.

The laziest correct fix is the right fix. Ship.
