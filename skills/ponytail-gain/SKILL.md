---
name: ponytail-gain
description: >
  Show ponytail's measured impact as a compact scoreboard: less code, less
  cost, more speed, from the agentic benchmark means. One-shot display, not a
  persistent mode, and not a per-repo number. Trigger: /ponytail-gain,
  "ponytail gain", "what does ponytail save", "show ponytail impact",
  "ponytail scoreboard".
---

# Ponytail Gain

Display this scoreboard when invoked. One-shot: do NOT change mode, write flag
files, or persist anything.

The figures are the published agentic means (12 feature tasks on a FastAPI +
React repo, Haiku 4.5, n=4). They are measured, not computed from the current
repo. Source: `benchmarks/results/2026-06-18-agentic.md` and the README.

## Scoreboard

Render plain ASCII bars. The bar length shows the measured cut vs no-skill.

```
  ponytail gain                     agentic mean · 12 tasks · Haiku 4.5

  Lines of code   no-skill  ████████████████████  100%
                  ponytail  █████████▎··········    46%   ▼ 54%
  Tokens          no-skill  ████████████████████  100%
                  ponytail  ███████████████▌····    78%   ▼ 22%
  Cost            no-skill  ████████████████████  100%
                  ponytail  ████████████████····    80%   ▼ 20%
  Time            no-skill  ████████████████████  100%
                  ponytail  ██████████████▋·····    73%   ▼ 27%

  This repo:  /ponytail-debt  (shortcuts you deferred)
              /ponytail-audit (what's still cuttable)
```

## Honesty boundary

These are published agentic means, not this repo. NEVER print a per-repo savings
number ("you saved X lines/tokens here"): the unbuilt version was never
written, so there is no real baseline to subtract from in a live repo. The
only real per-repo figures come from `/ponytail-debt` (a counted ledger), and
this card points there instead of inventing one.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop ponytail" or "normal mode": revert.
