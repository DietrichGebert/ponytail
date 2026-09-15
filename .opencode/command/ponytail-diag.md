---
description: "Structured debugging: flow traces, truth tables, hypothesis, to-dos (one-line verdict by default)"
---

Diagnose a failure with structured reasoning. Build an internal call-flow and truth-table model from code-as-data; do the analysis in reasoning, emit only the verdict. Default output: `ROOT CAUSE: <file>:<line> — <cause> | FIX: <direction> | PROBE: <line> <expr>`. If the user says "more" or "deep dive": add flow trace (branches annotated with actual true/false), truth table (if ≥2 flags), data validation table (invariant | expected | actual | verdict), hypotheses (For/Against/Test/Cost/Status), and a to-do ledger (TODO file:line: sev issue | fix | test). Extended methods when needed: fishbone/Ishikawa (≥3 subsystems), 5 Whys, waterfall/data-flow, barrier analysis, change analysis, fault tree, Pareto, concurrency/interleaving, timing/drift. Stop when a hypothesis reaches confirmed or the handoff to debug-fix is ready. Does not apply fixes.
