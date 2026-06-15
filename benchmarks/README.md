# Benchmark

Three arms (no skill, [caveman](https://github.com/JuliusBrussee/caveman), ponytail), three models, five everyday tasks, **10 runs per cell, median reported**. Code LOC is counted from fenced code blocks; tokens, cost, and latency come straight from the API.

## Reproduce

### Claude (Haiku / Sonnet / Opus)

Requires an Anthropic API key and **Node.js ≥ 22.22.0** (promptfoo's engine constraint —
check with `node --version` and upgrade if needed):

```bash
cp ../.env.example ../.env      # add your ANTHROPIC_API_KEY
npx promptfoo@latest eval -c promptfooconfig.yaml --repeat 10
npx promptfoo@latest view
```

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

## Median results (10 runs, 2026-06-13)

**Code (lines)**

| arm | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| baseline (no skill) | 518 | 693 | 256 |
| caveman | 116 | 120 | 67 |
| **ponytail** | **39** | **44** | **51** |

**Cost (USD, 5 tasks)**

| arm | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| baseline (no skill) | 0.032 | 0.141 | 0.135 |
| caveman | 0.014 | 0.045 | 0.075 |
| **ponytail** | **0.010** | **0.032** | **0.071** |

**Latency (seconds, 5 tasks)**

| arm | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| baseline (no skill) | 37.7 | 124.1 | 58.7 |
| caveman | 14.9 | 34.7 | 23.1 |
| **ponytail** | **9.9** | **20.1** | **18.0** |

Versus baseline, ponytail writes **80-94% less code**, costs **47-77% less**, and runs **3-6x faster**, on every model.

## Metrics

| File | Metric | Behavior |
|------|--------|----------|
| `loc.js` | `loc` | Measurement - always passes, records line count |
| `correctness.js` | `correct` | Gate - fails if generated code doesn't work |

`correctness.js` extracts fenced code blocks and runs per-task checks (spawns Python/Node for email, debounce, CSV; structural regex for React and FastAPI). A broken one-liner that scores great on LOC will fail on correctness.

> **Note:** The React countdown and FastAPI rate-limit checks are keyword/structural only (no runtime execution), so they verify plausible structure rather than full correctness. The email, debounce, and CSV checks execute the code.

### Prerequisites

Running the benchmark requires **Python 3**, **pandas**, and **Node.js** (18+).

## Notes

- Caveman is a prose-compression skill (it leaves code "normal"), so it lands between baseline and ponytail on code size and wins mainly on prose tokens.
- Cost reflects single-shot calls that re-send the skill every time. In real sessions the skill is injected once and prompt-cached, so the cost gap widens further in ponytail's favor.
- These are everyday tasks. For production-grade specs, where an unconstrained agent bloats much harder, see the writeups in `results/`.
