---
description: Review changes for over-engineering, what can be deleted
---

Review the current code changes for over-engineering only, not correctness. One line per finding: L<line>: <tag> <what to cut>. <replacement>. Tags: delete (dead code/speculative feature), stdlib (reinvented standard library), native (dependency doing what the platform does), yagni (abstraction with one implementation), shrink (same logic, fewer lines). For delete findings, check surviving references (including spread/dynamic props), comments, tests, and `ponytail:` markers. Replacement: nothing if no obligations remain; otherwise name the reference updates, rationale to preserve, tests to retarget for surviving behavior, and markers to remove only if their ceiling disappears. End with the net lines removable. If nothing to cut: 'Lean already. Ship.'
