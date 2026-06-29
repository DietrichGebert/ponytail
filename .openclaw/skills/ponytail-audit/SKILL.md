---
name: ponytail-audit
description: "Audit the whole repo for over-engineering. A ranked list of what to delete, simplify, or replace with stdlib or native features."
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

ponytail-review, repo-wide. Scan the whole tree instead of a diff. Rank
findings biggest cut first. This is an evidence pass, not a vibe pass: every
finding names a concrete file and line or it does not ship.

## Scan

Start with a fast map, then verify before reporting:

1. List files with `rg --files`, skipping `.git`, `node_modules`, vendor,
   generated output, lockfiles, coverage, and build artifacts.
2. Read manifests first (`package.json`, `pyproject.toml`, `go.mod`,
   `Cargo.toml`, etc.) to spot dependencies and scripts.
3. Search for common bloat shapes: `class|interface|abstract|factory|adapter|
   manager|provider|strategy|registry|wrapper|config|options|TODO|deprecated`.
4. For each suspect, trace references with `rg` before calling it dead or
   single-use.
5. Keep only findings where the replacement is obvious and smaller.

## Tags

Same as ponytail-review:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Hunt

Deps the stdlib or platform already ships, single-implementation interfaces,
factories with one product, wrappers that only delegate, files exporting one
thing, dead flags and config, hand-rolled stdlib.

Good targets:

- Dependency used once for a built-in capability.
- Config option with one value and no external caller.
- Interface/base class with one implementation.
- Registry/factory that always returns the same thing.
- Wrapper whose public method just forwards arguments.
- Custom parser/formatter/cache/retry helper that the stdlib or platform covers.
- Compatibility branch for a version the project no longer supports.

Do not flag:

- Trust-boundary validation, auth, security, accessibility, migrations, or
  data-loss prevention.
- Tests that cover non-trivial logic. One smoke test is ponytail minimum, not bloat.
- Public API compatibility unless the repo already allows breaking it.
- Generated files, lockfiles, vendored code, examples whose purpose is teaching,
  or benchmark arms whose purpose is comparison.
- Performance or correctness issues unless the fix is also strictly less code.

## Output

One line per finding, ranked by confidence and deletion size:

`<path>:L<line>: <tag> <what to cut>. <replacement>. saves ~<N> lines/<M> deps.`

Keep it tight: report the top 10 at most. If the evidence is fuzzy, omit it.
End with `net: -<N> lines, -<M> deps possible.` Nothing to cut:
`Lean already. Ship.`

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass. Lists findings, applies nothing. One-shot.
"stop ponytail-audit" or "normal mode" to revert.
