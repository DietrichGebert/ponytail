# Comprehension & reuse: fixing #245 and #217

*2026-06-22. Claude Code sessions on seeded repos. Sonnet 4.6, Opus 4.8, Haiku 4.5.*

Two issues argued ponytail was lazy in the wrong place:

- [#245 "Dangerously lazy"](https://github.com/DietrichGebert/ponytail/issues/245): the "shortest
  diff wins" reflex makes the agent patch the nearest symptom instead of tracing the problem end to
  end, and ship a confident wrong fix.
- [#217 "Missing rung"](https://github.com/DietrichGebert/ponytail/issues/217): rungs 2–4 reuse code
  from *outside* the project (stdlib, platform, deps); nothing covered "did I already write this
  here?", a common source of duplicated AI slop.

This run is built to be able to *disprove* the fix, not flatter it: every probe has a `good`/`bad`
reference proven by `run.py --selftest`, and the `bad` ref is correct on the happy path — it only
cuts the corner the issue is about.

## The fix

- **#217:** a new ladder rung 2, *"Already in this codebase? Reuse it, don't re-write it."*
- **#245:** a comprehension-first guard, plus the part that actually changed behaviour — an
  **operational** directive: *"Bug fix = root cause, not symptom. Grep every caller of the function
  you touch and fix the shared function once — one guard there is a smaller diff than one per
  caller; patching only the path the ticket names leaves a sibling caller still broken."*

The framing matters: the root-cause fix is presented as the *lazier* (smaller) diff, so ponytail's
own instinct pulls toward it rather than away.

## The #245 reproducer

`trace-transfer`: a `bank.py` where `transfer()` and `withdraw()` both debit through a shared
`_debit()`. The bug report names *transfers*; the lazy fix guards `transfer()` only and leaves
`withdraw()` overdrawing. The scorer exercises an overdrawing **withdraw** (never named in the
report), so only a fix that traces the flow and repairs the shared `_debit()` passes. `correct`
(a valid transfer + withdraw work) and the quality axis (the un-named withdraw is guarded) are
scored separately.

## Results — `trace-transfer`, n=6, root-cause-fix rate

| model | baseline (no skill) | ponytail (with fix) |
|---|--:|--:|
| **Sonnet 4.6** | 1/6 (0.17) | **6/6 (1.0)** |
| **Opus 4.8** | 1/6 (0.17) | **6/6 (1.0)** (held across 4 runs) |
| Haiku 4.5 | 0/6 (0.0) | ~0–2/6 (noise) |

On both capable models the fix is decisive and verified by reading the produced code: all passing
cells repair the shared `_debit()` (one even comments it is "the shared guard for every path that
removes money"). Baseline patches only the named `transfer()`.

A control confirms it is the *operational* wording, not prose: pre-fix ponytail and a plain-prose
version ("trace the flow end to end") both scored 0/3 on Opus; only the grep-the-callers directive
moved it to 6/6.

### Haiku: a model ceiling, not a regression

Haiku does not improve — but **the baseline also fails it (0/6)**. Reading Haiku's output, it
patches the named `transfer()` (or writes no guard) regardless of how forcefully the rule is
phrased; it does not reliably execute the multi-step "grep every caller, fix the shared function"
instruction. This is the same small-model transfer limitation already documented for the decision
ladder (see `2026-06-15-llama3.2-local.md`), not something the fix broke. Both arms are broken on
Haiku; the fix helps the models that have the headroom to act on guidance.

## #217: rung shipped, failure did not reproduce

Two reuse probes (`reuse-slug`, `reuse-money`) hide a distinctively-behaved helper in a separate
module the agent must discover; a re-implementation diverges observably (e.g. the project's
`slugify` transliterates accents, a hand-rolled regex does not). Across Sonnet, Opus and Haiku,
**baseline and ponytail both reuse the helper (1.0 each)** — the duplication failure does not
reproduce on these models even without the rung. The rung is correct guidance and regresses
nothing, but its behavioural value is unproven here; triggering the slop would likely need a far
larger, messier codebase.

## Regression check: did the rule edits break anything?

Pre-fix vs post-fix ponytail across the full 27-task runnable suite (safety + quality + open/vibe),
Haiku, n=3:

- **Safety: identical.** All seven deterministic safety tasks score 1.0 safe before and after —
  no guard dropped.
- **Less code: preserved**, and strong where there is over-build room (e.g. a JSON-config loader
  180→27 LOC, a text-adventure 281→138, a Markdown converter −40%).
- **Correctness: no systematic change.** The small mean difference is n=3 noise on flaky vibe tasks
  (`correct` = "the file compiles"); post-fix improved on as many tasks as it dipped.

One pre-existing wrinkle, unrelated to the fix: on the Node `todo-null` task, Haiku sometimes
*narrates* a complete solution in chat but leaves the file unwritten — present in the pre-fix arm
too, a small-model + "code-first" output interaction, not introduced here.

## Verdict

- **#245: fixed and validated on the capable tiers** (Sonnet 4.6, the model it was reported on, and
  Opus 4.8): baseline 1/6 → ponytail 6/6, with verified root-cause fixes. Small models remain a
  capability ceiling where baseline also fails.
- **#217: rung shipped as requested**, no regression; the duplication failure did not reproduce on
  these models, so the behavioural benefit is unproven rather than demonstrated.

Reproduce: `python run.py --selftest` then
`python run.py --task trace-transfer --arms baseline,ponytail --models sonnet --runs 6`.
