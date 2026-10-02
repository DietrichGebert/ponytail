---
description: Review changes, a branch, or any target for over-engineering
---

Review $ARGUMENTS for over-engineering only, not correctness. With no target, review the uncommitted working diff (git diff HEAD). 'branch' means the whole branch, not just the last commit: diff from the merge-base with the default branch (git merge-base HEAD origin/HEAD, falling back to origin/main then main) to HEAD. A ref/range/sha, 'staged', or a path names that target instead. Name the target and its line count in one line before the findings. One line per finding: L<line>: <tag> <what to cut>. <replacement>. Tags: delete (dead code/speculative feature), stdlib (reinvented standard library), native (dependency doing what the platform does), yagni (abstraction with one implementation), shrink (same logic, fewer lines). End with the net lines removable. If nothing to cut: 'Lean already. Ship.'
