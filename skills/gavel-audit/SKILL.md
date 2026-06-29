---
name: gavel-audit
description: >
  Whole-repo audit for test suite bloat and Test Constitution violations.
  Scans the entire codebase: unused POMs, dead locators, duplicate factories,
  orphaned tests, CSS/XPath overuse, hardcoded data, missing test.step().
  Ranked list of what to delete, simplify, or fix. Use when the user says
  "audit this test suite", "gavel-audit", "/gavel-audit", "find test bloat",
  or "what's wrong with my tests". One-shot report, does not apply fixes.
---

gavel-review, repo-wide. Scan the whole test tree instead of a diff. Rank
findings by impact (most violations first).

## Tags

Same categories as gavel-review, plus suite-level findings:

- `dead-pom:` page object with no spec referencing it. Replacement: delete.
- `dead-locator:` locator getter never used by any action or spec. Replacement: delete.
- `dup-factory:` factory that duplicates another factory's output. Replacement: consolidate.
- `orphan-test:` test with no matching feature/ticket, or testing removed functionality. Replacement: delete or verify relevance.
- `css-loc:` CSS/XPath selector count in the suite. Replacement: semantic locators.
- `selector-leak:` chained raw selector count outside locator classes (`locator.locator`, `querySelector`, `closest`, `.find()`, `$`, `find_element`). Replacement: named locators.
- `hardcoded:` hardcoded data count in test bodies. Replacement: factories.
- `no-step:` tests without logical grouping. Replacement: test.step().
- `manual-wait:` manual wait/sleep count. Replacement: web-first assertions.
- `no-di:` specs with direct instantiation. Replacement: fixture DI.
- `flake-risk:` tests with shared state, execution-order dependency, or non-idempotent cleanup. Replacement: isolate.

## Hunt

Scan for:
1. Unused page objects (grep for class references across specs)
2. Dead locator getters (grep for getter usage across actions/specs)
3. Duplicate factories (compare factory outputs)
4. Orphan tests (tests referencing removed features or tickets)
5. Constitution violations by count (CSS locators, selector leaks, hardcoded data, manual waits, missing steps)
6. Flake risk indicators (shared accounts, no cleanup, execution-order tests)

## Output

One line per finding, ranked by impact:
`<tag> <what to cut or fix>. <replacement>. [path]`

End with a summary:
```
Suite health:
  <N> tests, <M> specs, <P> page objects
  Constitution violations: <count by category>
  Dead code: <count> unused POMs, <count> dead locators
  Flake risk: <count> tests with shared state
  net: -<N> lines, -<M> files possible.
```

Nothing to cut: `Lean suite. Ship.`

## Boundaries

Scope: test bloat, dead code, and Test Constitution violations only.
Correctness bugs, security holes, and performance are out of scope.
Lists findings, applies nothing. One-shot.
"stop gavel-audit" or "normal mode" to revert.
