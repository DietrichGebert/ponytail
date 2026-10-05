---
name: ponytail-gain
description: >
  Show ponytail's measured impact as a compact scoreboard: less code, less
  cost, more speed, from the agentic benchmark averages. One-shot display, not a
  persistent mode, and not a per-repo number. Trigger: /ponytail-gain,
  "ponytail gain", "what does ponytail save", "show ponytail impact",
  "ponytail scoreboard".
---

# Ponytail Gain

Display this scoreboard when invoked. One-shot: do NOT change mode, write flag
files, or persist anything.

The figures are the published agentic benchmark averages: a headless Claude
Code session (Haiku 4.5) doing 12 feature tickets on a real FastAPI + React
repo, each task averaged over 4 runs, against the same agent without the
skill, plus 6 safety tasks. They are measured, not computed from the current
repo. Source: `benchmarks/results/2026-06-18-agentic.md` and the README.

## Scoreboard

Render plain ASCII bars. The bar length shows ponytail as a share of the
no-skill baseline; the label carries the exact figure:

```
  ponytail gain                  benchmark average · 12 tasks · Haiku 4.5

  no-skill        ████████████████████  100%
  Lines of code   █████████···········   46%   ▼ 54%
  Tokens          ████████████████····   78%   ▼ 22%
  Cost            ████████████████····   80%   ▼ 20%
  Time            ███████████████·····   73%   ▼ 27%
  Safety kept     100%  (validation, error handling, security)

  This repo:  /ponytail-debt  (shortcuts you deferred)
              /ponytail-audit (what's still cuttable)
```

## Honesty boundary

These are benchmark averages, not this repo. NEVER print a per-repo savings
number ("you saved X lines/tokens here"): the unbuilt version was never
written, so there is no real baseline to subtract from in a live repo. The
only real per-repo figures come from `/ponytail-debt` (a counted ledger), and
this card points there instead of inventing one.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop ponytail" or "normal mode": revert.
