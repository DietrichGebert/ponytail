---
name: ponytail-audit
description: >
  Whole-codebase audit for over-engineering. Scans a repository and produces a
  ranked report of things to delete, simplify, or replace with stdlib/native
  equivalents. Covers: single-implementation abstractions, reinvented standard
  libraries, unnecessary dependencies. Use when the user says "audit this codebase",
  "audit for over-engineering", "what can I delete from this repo",
  "find bloat", "ponytail-audit", "/ponytail-audit", or "review the whole
  project for complexity". One-shot — produces a report, does not apply fixes.
license: MIT
---

# Ponytail Audit

Whole-repository scan for unnecessary complexity. Outputs a ranked report.
Does not apply fixes.

## Trigger

One-shot. Activate on demand only. Not persistent across responses.

## Scan process

Work in this order. Each phase narrows the next.

### Phase 1: Map the landscape

1. Read the project structure (directory tree, build files, dependency lists).
2. Identify the tech stack: language(s), framework(s), build system, dependency count.
3. Count: total files, total source files, total lines of source code (estimate).

### Phase 2: Dependency audit

For each direct dependency in build files (pom.xml, build.gradle.kts, package.json, requirements.txt, Cargo.toml, go.mod, etc.):

- Does the language stdlib already provide this? → `stdlib: dep X, stdlib has Y`
- Does the platform/framework provide this? → `native: dep X, platform has Y`
- Is it used by more than one file? Grep for imports. Single file → `delete: dep X used in 1 file`
- Is it a transitive dep already provided by a framework dep? → `shrink: dep X, already in Y's tree`

Rank by: deps that can be fully removed first.

### Phase 3: Abstraction audit

Scan source files for these patterns:

- Interface/protocol with exactly one implementation → `yagni: interface X, 1 impl Y. Inline until a second exists.`
- Abstract base class with one subclass → `yagni: abstract X, subclass Y. Collapse.`
- Factory that produces one product → `yagni: factory X, creates Y only. Constructor call.`
- Config/constant file where every value is used exactly once → `shrink: config X, inline the values.`
- Wrapper/decorator that adds nothing over the wrapped thing → `delete: wrapper X, delegates all calls to Y.`
- Module/file that exports one function/class → `shrink: file X exports Y. Merge into caller.`
- Dependency injection for dependencies that are never swapped in tests → `yagni: DI for X, never mocked. Construct directly.`

### Phase 4: Code-level audit

Sample up to 20 source files (largest first, then random). For each:

- Hand-rolled algorithm that stdlib provides → `stdlib: file X line N, hand-rolled Y. Use Z.`
- Utility function duplicating a built-in → `stdlib: file X, util Y. Built-in Z does this.`
- Error handling that swallows and re-throws identically → `shrink: file X, catch-and-rethrow. Remove wrapper.`
- Comments that repeat the code → `delete: file X, comments restate the code. Code is the doc.`
- Feature flag / config toggle never set to the alternate value → `yagni: file X, toggle Y always Z. Remove the branch.`
- Logging/debug scaffolding in production paths → `delete: file X, debug logging. Replace with structured logger or remove.`

## Output format

Produce the report in this structure:

```
# Ponytail Audit: <project-name>

## Summary
- Stack: <languages, frameworks>
- Source files: <N> (<lines> lines)
- Direct dependencies: <N>
- Findings: <N>

## Top 10 (biggest impact, least effort)

1. `<tag>` <what to cut>. <what replaces it>. [file/path]
2. ...

## Dependency savings (<N> removable)

| Dep | Used in | Replace with | Estimated lines saved |
|-----|---------|--------------|---------------------|
| ... | ...     | ...          | ...                 |

## Abstraction savings (<N> collapsible)

- `<tag>` <finding>. [file/path]

## Code-level savings (<N> findings)

- `<tag>` <finding>. [file/path]

## Bottom line

net: -<N> lines possible, -<M> dependencies possible.
```

Tags match ponytail-review: `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`.

## Boundaries

- Complexity only. Correctness bugs, security holes, performance problems → different review.
- Does not apply fixes. Lists findings only.
- Sampling-based for large codebases — you do not need to read every file.
- One-shot report. "stop ponytail-audit" or "normal mode" to revert.
