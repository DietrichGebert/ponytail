---
name: ponytail
description: Use on any coding task, or explicit ponytail, minimal, or YAGNI requests. Choose the smallest correct implementation after understanding the task; do not use for noncoding.
argument-hint: "[lite|full|ultra]"
license: MIT
---

# Ponytail

Use adaptive minimalism from a lazy senior developer. Use on ANY coding task: writing, adding, refactoring, fixing, reviewing, or designing code. This is a per-task policy, not a global personality or status mode. A preceding legacy hook header naming `lite`, `full`, or `ultra` is an explicit mode; otherwise default to adaptive. Disengage for noncoding work.

## Before the ladder

Lock the requested outcome, constraints, host role, tool/delegation rules, and proof gate. Read the task and relevant code before minimizing; trace the real flow in this codebase. Never shrink or refuse explicit scope.

Choose intensity per task or subtask:

| Level | Use |
|---|---|
| **lite** | Advisory guidance for broad, architecture, high-integrity, design, migration, security, money, device, or unclear work. |
| **full** | Binding minimalism for an ordinary bounded implementation, refactor, or fix, within the complete outcome. |
| **ultra** | Only when explicitly requested; never automatically. |

Worked examples: `lite: "Build the requested migration, but name a simpler path."` · `full: "Use the existing native primitive and its one check."` · `ultra: "Delete speculative work before adding anything."`

## The ladder

1. Does this need to exist? Remove speculative work.
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Existing dependency solves it? Use it.
6. Otherwise write the minimum correct code.

Bug fix means root cause: inspect callers before editing the shared path. Prefer deletion and boring code. Do not add abstractions, boilerplate, or dependencies without need. Two rungs work: take the higher one and move on. For equal-size choices, use the edge-case-correct algorithm. Mark a deliberate ceiling such as a naive heuristic with a `ponytail:` comment and upgrade trigger.

## Proof and boundaries

Keep input validation at trust boundaries, error handling that prevents data loss, security, accessibility, performance, and quality. Lazy code without its check is unfinished. Add one runnable check for non-trivial logic; use proportional integrated proof for larger work. Never repeat a passing check unless its cause changed. Preserve every user-requested verification and ship gate.

Do not narrate a mode, badge, activation, forced first-code ordering, three-line output, canned epilogue, or challenge to an already-explicit requirement. Follow the host's communication style. The shortest path to the requested outcome is the right path. Use one runnable check for non-trivial logic; lazy code without its check is unfinished.

## Explicit levels

`/ponytail lite`, `/ponytail`, and `/ponytail ultra` (or the host's equivalent) apply only to that task. Ultra never becomes automatic.
