---
description: Audit the whole repo for over-engineering, what can be deleted
---

Audit the entire repository for over-engineering only, not correctness. Scan the whole tree, not a diff. Before emitting delete, grep the whole tree for the symbol, including tests, fixtures and string or dynamic references. One numbered line per finding, ranked biggest cut first: N. <tag> <what to cut>. <replacement>. [path]. Tags: delete (dead code/speculative feature), stdlib (reinvented standard library), native (dependency doing what the platform does), yagni (abstraction with one implementation), shrink (same logic, fewer lines), reuse (duplicates a helper already in this repo). End with the net lines and dependencies removable. If nothing to cut: 'Lean already. Ship.'
