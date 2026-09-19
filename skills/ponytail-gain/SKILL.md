---
name: ponytail-gain
description: >
  Show ponytail's measured impact as a compact scoreboard: less code, less
  cost, more speed, from the agentic benchmark. One-shot display, not a
  persistent mode, and not a per-repo number. Trigger: /ponytail-gain,
  "ponytail gain", "what does ponytail save", "show ponytail impact",
  "ponytail scoreboard".
---

# Ponytail Gain

Display this scoreboard when invoked. One-shot: do NOT change mode, write flag
files, or persist anything.

The figures are the published agentic benchmark: 12 feature tickets on a real
FastAPI + React repo, real Claude Code sessions on Haiku 4.5, n=4, against the
same agent with no skill. Lines of code is the total over all 12 tasks (94% is
the best single task). They are measured, not computed from the current repo.
Source: `benchmarks/results/2026-06-18-agentic.md` and the README.

## Scoreboard

Render plain ASCII bars. The bar length shows the measured value; the label
carries the exact figure:

```
  ponytail gain                  agentic benchmark · 12 tasks · Haiku 4.5

  Lines of code   no-skill  ████████████████████  100%
                  ponytail  █████████···········   46%   ▼ 54% (up to 94%)
  Cost            no-skill  ████████████████████  100%
                  ponytail  ████████████████····   80%   ▼ 20%
  Speed           ponytail  ▸ 27% faster
  Safety          ponytail  ▸ 100% safe (20/20 adversarial runs)

  This repo:  /ponytail-debt  (shortcuts you deferred)
              /ponytail-audit (what's still cuttable)
```

## Honesty boundary

These are benchmark figures, not this repo. NEVER print a per-repo savings
number ("you saved X lines/tokens here"): the unbuilt version was never
written, so there is no real baseline to subtract from in a live repo. The
only real per-repo figures come from `/ponytail-debt` (a counted ledger), and
this card points there instead of inventing one.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop ponytail" or "normal mode": revert.
