---
name: ponytail-audit
description: "Audit the whole repo for over-engineering. A ranked list of what to delete, simplify, or replace with stdlib or native features."
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

ponytail-review, repo-wide. Scan the whole tree instead of a diff. Rank
findings by reduction in concepts and distributed policy, then by size of the cut.
Keep boundaries that contain policy; do not move complexity into callers to save lines.

## Tags

Same as ponytail-review:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` speculative abstraction, config nobody sets, layer that contains no necessary policy.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Hunt

Deps the stdlib or platform already ships, speculative interfaces and factories,
wrappers that only delegate without containing policy, dead flags and config,
hand-rolled stdlib. One implementation or one export alone is not evidence of bloat.

## Output

One line per finding, ranked: `<tag> <what to cut>. <replacement>. [path]`.
End with `net: -<N> lines, -<M> deps possible.` Nothing to cut: `Lean already. Ship.`

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass. Lists findings, applies nothing. One-shot.
"stop ponytail-audit" or "normal mode" to revert.
