# Cost verification: reproducing the "47-77% cheaper" claim (2026-06-17)

Context: the README headline says ponytail is "47-77% cheaper." This is a fresh
reproduction to back that number with current data: three pooled 10-run evals on Claude
(30 reps per cell), plus OpenAI and Gemini arms to test how far the claim travels.

## TL;DR

- On Claude, ponytail is **42-75% cheaper** than no-skill across Haiku, Sonnet, and Opus
  (pooled 30 reps). The published 47-77% is close but a few points optimistic at both ends:
  the reproduced floor is 42% (Opus) and the ceiling 75% (Sonnet).
- The cost win is **Claude-specific**. On OpenAI it mostly reverses: gpt-4.1-mini is 40%
  cheaper, but gpt-5.4-mini is **26% more expensive** and the newest top model **gpt-5.5 is
  39% more expensive** and not faster. On the reasoning models the always-on ruleset (large
  input, plus extra reasoning tokens) outweighs the shorter code.
- Latency holds on Claude: **3.1-5.8x faster**, inside the README's "3-6x". On OpenAI it is
  mixed (2.5x on gpt-4.1-mini, down to 0.9x on gpt-5.5).
- Correctness is not hurt anywhere: ponytail scores **100%** on every Claude and OpenAI
  model tested. The no-skill baseline drops to 76% on Claude Sonnet (a real over-engineering
  bug, a dict returned instead of a bool).
- Gemini (gemini-3.5-flash, gemini-3.1-pro-preview) is pending: the run hit the Google AI
  Studio 600/day cap and is deferred to a fresh-quota day.

## Method

Three arms (no skill, caveman, ponytail) on Claude; baseline vs ponytail on OpenAI. Five
everyday tasks, `--repeat 10` per run. Cost comes from promptfoo API telemetry
(`response.cost`). Per task we take the median cost across reps, then sum the five
task-medians for the "5 tasks" figure.

- Claude: three runs pooled to **30 reps per cell**.
- OpenAI: **10 reps**. Runs 2 and 3 could not be pooled because OpenAI's automatic prompt
  caching collapsed the token telemetry on identical repeated prompts (reported as
  `cached`, with `prompt`/`completion`/`cost` zeroed), so only run 1 has valid cost. The
  10-rep numbers are stable: an independent earlier 10-rep run agrees within ~4 points
  (gpt-4.1-mini 35.7% vs 39.6%, gpt-5.4-mini 28.7% vs 26.2% more expensive). Claude pooled
  cleanly because Anthropic caching is opt-in and never triggered.

Reproduce:

```bash
npx promptfoo@latest eval -c benchmarks/promptfooconfig.yaml --env-file .env --repeat 10
npx promptfoo@latest eval -c benchmarks/promptfooconfig.gpt-newest.yaml --env-file .env --repeat 10
```

## Results

### Claude (pooled, 30 reps, USD for 5 tasks)

| model | baseline | caveman | ponytail | ponytail vs baseline |
|---|--:|--:|--:|--:|
| Haiku | 0.0299 | 0.0139 | 0.0110 | **63.1% cheaper** |
| Sonnet | 0.1367 | 0.0458 | 0.0348 | **74.5% cheaper** |
| Opus | 0.1368 | 0.0724 | 0.0789 | **42.3% cheaper** |

**Range: 42-75% cheaper** (vs the published 47-77%). Latency 3.1-5.8x faster; ponytail
correctness 100% on all three.

### OpenAI (10 reps, USD for 5 tasks)

| model | baseline | ponytail | ponytail vs baseline | latency | correctness |
|---|--:|--:|--:|--:|--:|
| gpt-4.1-mini | 0.0026 | 0.0015 | **39.6% cheaper** | 2.5x faster | 100% |
| gpt-5.4-mini | 0.0060 | 0.0075 | **26.2% more expensive** | 1.5x faster | 100% |
| gpt-5.5 | 0.0714 | 0.0990 | **38.7% more expensive** | 0.9x (slower) | 100% |

The reasoning models (gpt-5.4-mini, gpt-5.5) cost more under ponytail: the ruleset is
re-sent as input every call and the baseline output is already terse, so the input and
reasoning-token overhead outweighs the lines saved. Effective per-token rates derived from
run 1: gpt-5.5 ~$5/$30 per M in/out, gpt-5.4-mini $0.75/$4.50, gpt-4.1-mini ~$0.13/$1.61.

### Gemini

Pending. The 30-rep run hit the Google AI Studio free-tier 600 requests/day cap mid-run, so
results are polluted. Rerun on a fresh-quota day: gemini-3.5-flash (mini) and
gemini-3.1-pro-preview (top), baseline vs ponytail.

## Takeaway

The Claude claim holds in direction but is a few points high: the reproduced, pooled range
is **42-75% cheaper on Claude**, faster on every Claude model, with no correctness cost.
Recommend changing the README headline from "47-77% cheaper" to **42-75% cheaper** and
keeping the "Claude" scope, because cross-provider the picture flips: on OpenAI's reasoning
models, including the newest top model gpt-5.5, ponytail costs more, not less. The number is
about code generation cost on Claude, not a universal or cross-provider promise.

## Notes

- About 22 of 1350 Claude reps dropped on transient empty responses; excluded from medians,
  immaterial at this n. OpenAI runs were 100% complete.
- Reproduce from the committed configs: `promptfooconfig.yaml` (Claude),
  `promptfooconfig.gpt-newest.yaml` (OpenAI), `promptfooconfig.gemini.yaml` (Gemini). The
  raw eval JSON is gitignored and regenerable.
