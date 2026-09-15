---
name: ponytail-port
description: >
  Token-efficient port feasibility. Builds an internal data model (call graph,
  dependency waterfall, risk cascade, verification runway), emits a one-line
  verdict by default. Expands only on request. Pairs with ponytail-diag for
  deep branch validation. Integrates debug-reference, debug-reduce, debug-
  hypothesis, debug-verify, debug-fix, knowledge-base.
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

# Ponytail Port

Map functions to a target platform with minimal output. All analysis happens
in reasoning — **one-line verdict by default**, expansion only on request.

## Default (minimal output)

Emit exactly one line:

`<fn> → <direct|adapt|rethink> | feas: green|yellow|red | verify: r<w> | risk: low|med|high | doc: ports/<name>.md`

Example: `fetch_data → direct | feas: green | verify: r3 | risk: low | doc: ports/App-20260915-1430.md`

No prose. No templates. Say "more" or "deep dive" to expand.

## Internal model (no output unless asked)

Build a data model of each function and its port path, never emitted:

1. **Call graph depth.** Leaf functions (no local deps) first. Depth >3 →
   cap scope or reconsider module boundary.
2. **Dependency waterfall.** Trace: `fn → lib_a → lib_b → libc`. First dep
   unavailable on target = bottleneck → `deps=NO`.
3. **Control-flow parity.** Does the target preserve every branch's semantics
   and the error contract (exception types, return codes, fallback)?
4. **Concurrency model.** Source model → target model. No happens-before
   preservation = `rethink`.
5. **Memory/ownership model.** GC→manual, shared-mutable→immutable, raw
   pointers→refs. Borrow-checker mismatch = `rethink`.
6. **Risk cascade.** Each `adapt` → +1 verification rung. Each `rethink` →
   +2. Pure `direct` leaf → rung 3.
7. **Reference port ladder.** Normalise inputs/precision/ordering/seeds/versions
   before declaring a mismatch.
8. **Performance budget.** Latency ≤ X ms, throughput ≥ Y ops/s from source spec.
   Exceeds target tier = infeasible.

This model drives the one-line verdict. It is **not printed**.

## Verdict matrix

```
mapping   | perf | correct | deps | verdict
direct    | ✓    | ✓       | ✓    | green  — ship
adapt     | ✓    | ✓       | ✗    | yellow — shim + watch
adapt     | ✗    | ✓       | ✓    | red    — rethink
rethink   | *    | *       | *    | red    — redesign approach
```

`deps=NO` or `rethink` → escalate to rung 5+ of debug-verify.

## When to expand

Say "more", "deep dive", or "show work" → emit only:

```
SRC: fn_x(args) — purpose: <one line>
TGT: <platform>
MAP: direct|adapt|rethink  feas: green|yellow|red
H1: <risk> For:<ev> Against:<ev> Test:<exp>
VERIFY: r5 PASS|FAIL|NOT RUN (escalated by risk cascade)
EDGE: <untested state-space row>
DOC: ports/<ProjectName-YYYYMMDD-HHMM.md>
```

One block. No prose.

## State-space coverage (expanded only)

When ≥2 target flags combine, enumerate and mark reachability:

`dev=gpu async pinned → PASS`
`dev=cpu sync  no    → <untested>`
`dev=gpu async yes   → FAIL  ←`

Each untested row on the failing path → TODO.

## Knowledge-base handoff

When a port reaches PASS under verification:
emit `KB: pattern="posix pthread → target mutex wrapper" verdict=green` —
a sanitised one-liner that future ports of the same mapping skip the analysis.

Only when KB is active. No persistent writes unless asked.

## Boundaries

- Does not blindly transliterate. Mechanical 1:1 port that loses perf or
  correctness = rejected.
- Does not create study docs unless asked to persist.
- `stop ponytail-port` or `normal mode`: revert.
