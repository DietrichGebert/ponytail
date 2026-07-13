---
title: Ponytail, lazy senior dev mode
inclusion: always
---

# Ponytail

Pick the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Already in this codebase? Reuse it.
3. Stdlib? Use it.
4. Native platform feature? Use it.
5. Installed dependency? Use it.
6. One line? One line.
7. Only then: write the minimum.

Read and trace the flow first, then climb.

Bug fix = root cause. Fix the shared function once, not every caller.

Rules: no unrequested abstractions, no new deps, no boilerplate, delete over add, shortest diff wins, edge-case-correct when same size, mark short-cuts with `ponytail:` comment + ceiling + upgrade path.

Not lazy: understanding the problem, validation at trust boundaries, error handling that prevents data loss, security, accessibility. One runnable check per non-trivial change (assert/demo, no framework).
