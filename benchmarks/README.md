# Benchmark

Three arms (no skill, [caveman](https://github.com/JuliusBrussee/caveman), ponytail), three models, five everyday tasks, **10 runs per cell, median reported**. Code LOC is counted from fenced code blocks; tokens, cost, and latency come straight from the API.

## Reproduce

### Claude (Haiku / Sonnet / Opus)

Requires an Anthropic API key and **Node.js ≥ 22.22.0** (promptfoo's engine constraint,
check with `node --version` and upgrade if needed):

```bash
cp ../.env.example .env      # add your ANTHROPIC_API_KEY
npx promptfoo@latest eval -c promptfooconfig.yaml --env-file ../.env --repeat 10
npx promptfoo@latest view
```

`--env-file ../.env` is required because promptfoo reads `.env` from the current
directory (`benchmarks/`), not the repo root where the file lives.

### Local models via Ollama

No API key or promptfoo required. Runs against any model served by Ollama:

```bash
ollama pull llama3.2          # or any other model
python benchmarks/benchmark-local.py --model llama3.2 --repeat 3
```

See `benchmarks/results/2026-06-15-llama3.2-local.md` for what to expect: the skill works
well on instruction-following models (Claude-class) but transfers poorly to small local
models where the multi-step decision ladder isn't reliably followed.

Tasks: email validator, JS debounce, CSV sum, React countdown, FastAPI rate-limit (see `promptfooconfig.yaml`). Single-shot completions, default temperature.

## Median results (10 runs, 2026-06-13; cost re-verified at 30 runs, 2026-06-17)

**Code (lines)**

| arm | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| baseline (no skill) | 518 | 693 | 256 |
| caveman | 116 | 120 | 67 |
| **ponytail** | **39** | **44** | **51** |

**Cost (USD, 5 tasks; 30 runs, 2026-06-17)**

| arm | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| baseline (no skill) | 0.030 | 0.137 | 0.137 |
| caveman | 0.014 | 0.046 | 0.072 |
| **ponytail** | **0.011** | **0.035** | **0.079** |

**Latency (seconds, 5 tasks)**

| arm | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| baseline (no skill) | 37.7 | 124.1 | 58.7 |
| caveman | 14.9 | 34.7 | 23.1 |
| **ponytail** | **9.9** | **20.1** | **18.0** |

Versus baseline, ponytail writes **80-94% less code**, costs **42-75% less**, and runs **3-6x faster**, on every Claude model. Cost re-verified at 30 reps, with OpenAI and Gemini arms, in [results/2026-06-17-cost-verification.md](results/2026-06-17-cost-verification.md).

> **Read this number honestly (updated 2026-06-18).** The gap above is single-shot, against a bare
> model that answers with several options plus commentary, so it counts prose, not just code, and
> overstates the win. [#126](https://github.com/DietrichGebert/ponytail/issues/126) was right about
> that. The [agentic benchmark](agentic/) re-runs the comparison as a *real Claude Code session on a
> real public repo*: ponytail cuts **60-94%** on features with an over-build trap (custom component
> vs native input), is a wash on already-minimal code, never writes more, and stays **100% safe**
> while the bare "one-liner" prompt drops a guard. That is the honest, defensible number. See
> [results/2026-06-18-agentic.md](results/2026-06-18-agentic.md).

## Independent benchmarks

Run by other people, not by us, on their own harnesses and machines. Linked for
transparency: the numbers are theirs, may shift between runs, and are corroboration
rather than official figures. Only plugin-installed runs are listed, since pasting
`SKILL.md` into a prompt is a rough approximation of `full` and skews the result.

| Source | Method | Headline | Date |
|---|---|---|---|
| [KuldeepB19](https://kuldeepb19.github.io/ponytail-benchmark/) | Installed plugin, 24 tasks, no-skill vs Lite/Full/Ultra, 5 runs each (480 builds), Opus 4.8, graded by executing the code | ~44% less code (53% fewer statements), no correctness or security regression; trims everyday bad-input handling on 5/24 tasks | 2026-06-24 |
| [RicardoCostaGit](https://github.com/RicardoCostaGit/ponytail-benchmark-from-cursor) | Multi-turn agentic runs via the Cursor SDK, isolated git worktrees, rule file toggled per run | Leaner output but higher process cost (more tool calls/tokens) on large completion-forced tasks; savings land on blocked/snowball-prone tasks | 2026-06-16 |

Both land on the same split as the honesty note above: ponytail reliably writes less
code, and whether that *saves money* depends on the workload (big win on
over-build and blocked tasks, can cost more on large completion-forced agentic runs).

## Metrics

| File | Metric | Behavior |
|------|--------|----------|
| `loc.js` | `loc` | Measurement - always passes, records line count |
| `correctness.js` | `correct` | Gate - fails if generated code doesn't work |

`correctness.js` extracts fenced code blocks and runs per-task checks (spawns Python/Node for email, debounce, CSV; structural regex for React and FastAPI). A broken one-liner that scores great on LOC will fail on correctness.

> **Note:** The React countdown and FastAPI rate-limit checks are keyword/structural only (no runtime execution), so they verify plausible structure rather than full correctness. The email, debounce, and CSV checks execute the code.

### Prerequisites

Running the benchmark requires **Python 3**, **pandas**, and **Node.js ≥ 22.22.0** (promptfoo's engine constraint; see [Reproduce](#reproduce)).

## Notes

- Caveman is a prose-compression skill (it leaves code "normal"), so it lands between baseline and ponytail on code size and wins mainly on prose tokens.
- Cost reflects single-shot calls (one prompt, one completion), not real multi-turn agent sessions. In a session the ruleset re-injects and the ladder deliberates every turn across many turns, so per-session cost can come out higher or lower than these numbers. Prompt caching offsets some of the re-injection, but a measured agentic A/B ([#121](https://github.com/DietrichGebert/ponytail/issues/121)) found ponytail can also raise tool calls and cost on completion-forced tasks. Treat these as generation numbers, not a session-cost promise.
- These are everyday tasks. For production-grade specs, where an unconstrained agent bloats much harder, see the writeups in `results/`.
