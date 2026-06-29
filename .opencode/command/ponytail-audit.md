---
description: Audit the whole repo for over-engineering, what can be deleted
---

Audit the entire repository for over-engineering only, not correctness. Use evidence: list files with rg --files, skip .git/node_modules/vendor/generated/build/coverage/lockfiles, read manifests first, search for deps, wrappers, one-use abstractions, factories, dead config, and hand-rolled stdlib. Verify every suspect with rg references before reporting. One line per finding, top 10 max, ranked by confidence and deletion size: <path>:L<line>: <tag> <what to cut>. <replacement>. saves ~<N> lines/<M> deps. Tags: delete, stdlib, native, yagni, shrink. Do not flag security, validation, accessibility, migrations, data-loss prevention, generated files, lockfiles, teaching examples, benchmark arms, or useful tests. End with net: -<N> lines, -<M> deps possible. If nothing to cut: 'Lean already. Ship.'
