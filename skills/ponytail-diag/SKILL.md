---
name: ponytail-diag
description: >
  Token-efficient structured debugging. Builds an internal call-flow + truth-table
  model from code-as-data, emits a one-line verdict by default. Expands only on
  request. Integrates debug-root-cause, debug-reduce, debug-hypothesis,
  debug-reference, debug-fix, knowledge-base. Minimal input: "what should happen"
  vs "what did happen".
---

# Ponytail Diag

Diagnose failures by building an internal model of the code (call graph,
control-flow branches, data-state transitions) and emitting only the verdict.
All heavy analysis happens in reasoning — **zero output tokens** until the
final verdict line.

## Default (minimal output)

Emit exactly one line:

`ROOT CAUSE: <file>:<line> — <one-line cause> | FIX: <one-line direction> | PROBE: <line> <expr>`

Example: `ROOT CAUSE: parser.py:42 — len(fields)<3 not guarded before unpack | FIX: add guard or use unpack-safe pattern | PROBE: 42 assert len(fields)>=3`

No prose. No tables. No templates. If the user asks "more" or "deep dive",
then expand to the 5-step detail.

## Internal model (no output unless asked)

Build a data model of the failure path, never emitted:

1. **Call graph.** Trace entry → exit. Name every branch and its static
   condition. If static analysis can't resolve it, mark `[dynamic]`.
2. **Branch truth table.** For every `if`/`switch`/`match` on the failing
   path, record `[taken=true/false]` with the concrete value that caused it.
3. **Data-state flow.** Track each variable: `[init → assign → mutate → use]`.
   A `nil`/`None`/`undefined` that appears at a branch with no preceding
   assignment in the trace = untraced branch or stale alias → flag internally.
4. **Invariant check.** At each step, check the contract: type, non-null,
   range, count. Record `[OK | BROKEN]` internally.
5. **Root-cause filter.** Map surviving evidence to the
   `failure → first bad state → triggering operation → violated expectation →
   defect` chain. Rank hypotheses by information-gain-per-cost (cheapest
   experiment that falsifies the most).

This model drives the one-line verdict. It is **not printed**.

## When to expand

Say "more", "deep dive", or "show work" → emit only:

```
FLOW: <entry> → fn_A[br1:F] → fn_B[br2:T] → crash
DATA: var_x=100 → fn_A → nil → fn_B  ← nil appears without reassignment
H1: <claim>  For:<ev> Against:<ev> Test:<exp> Cost:low Status:unknown
TODO:fn_B.py:12:fix nil-guard Test:feed_nil_repro
```

Three sections, no prose. That's the ceiling for expanded output.

## Truth tables (only in expanded mode)

Only when ≥2 flags combine. Mark reachability:

`flA=F flB=T → path-D  ← (failing)`
`flA=T flB=F → path-E  <untested>`
`flA=T flB=T → path-F  <unreachable>`

Boundary gaps → TODOs. One line per row.

## Hypothesis block (expanded only)

```
H<n>: <claim>
For: <evidence>  Against: <evidence>
Test: <cheapest experiment>
```

Keep ≤4 live. Eliminate contradicted ones immediately.

## To-do ledger (expanded only)

`TODO <file>:<line>: [sev:P0|P1|P2] <issue> | fix: <candidate> | test: <repro>`

`P0` — root defect / blocks repro. `P1` — real defect, doesn't block repro.
`P2` — hardening gap. Only emit todos actionable today.

## Extended methods (expanded only)

- **Fishbone / Ishikawa** — ≥3 subsystems at fault. Categories: Method,
  Machine, Material, Man. Test bottom-up.
- **5 Whys** — opaque single-cause. `Q: why? A: because.` Repeat to a choice
  (req/dep/config), not a component.
- **Waterfall trace** — intermittent/state-dependent. Trace one input through
  every call. First unexpected value = probe target. Cross-trace consistency:
  value materialising "from nowhere" = skipped branch or stale alias.
- **Barrier analysis** — what should have stopped this? Existence + bypass =
  logic error. Absent = design gap → TODO.
- **Change analysis** — "worked last week". Smallest code/env diff correlating
  with onset = prime suspect.
- **FTA (fault tree)** — logic-heavy. Top event → AND/OR gates → basic events.
  AND = all parents occur. OR = any suffices.
- **Pareto** — many suspects. Rank by frequency; probe the top 20%.
- **Concurrency/race** — enumerate interleavings. No happens-before = defect.
- **Timing/drift** — intermittent timeouts. Sample clocks + RSS + disk + CPU.
  Spike >2σ at the bad-state boundary = suspect.

## Handoff

When a hypothesis reaches `confirmed` (fix removes failure under tests):
emit `HANDOFF: debug-fix ready — one repro, one patch, one verify.`
Do not apply fixes in diag mode.

## Boundaries

- Zero guessing. Every branch annotation and hypothesis traces to real input,
  call site, or evidence. If static-only, say `PROBE NEEDED` in the verdict.
- If no known-good reference exists, validate by invariants alone.
  Do not fabricate a reference.
- Probe placement: branch decision → function entry with args → invariant
  assert before `nil` propagates. Suggest exact line + expression.
- Does not apply fixes. Does not write study docs unless asked.
- `stop ponytail-diag` or `normal mode`: revert.
