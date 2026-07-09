# Correctness under Ponytail: gate fixes + GPT-mini reproduction (2026-06-16)

Context: [issue #65](https://github.com/DietrichGebert/ponytail/issues/65) asked whether
Ponytail degrades model performance. A community run (Pyseph) reported a large correctness
drop on `gpt-4.1-mini` (10/15 with Ponytail vs 15/15 without) and a small one on
`gpt-5.4-mini` (14/15 vs 15/15).

Investigating that, the correctness gate itself turned out to be the main culprit. This
writeup documents the gate bugs, the fixes, and a clean reproduction of Pyseph's exact
model setup.

## TL;DR

- The `correct` gate had two bugs that **under-reported correctness for terse models** — it
  could not read unfenced code, and the debounce task tested for a deliverable the prompt
  never asked for.
- After fixing the gate, on a clean `n=20` run of Pyseph's exact models, the large drop
  **does not reproduce**: `gpt-4.1-mini` is 100% with *and* without Ponytail.
- Ponytail roughly **halves** median code size, the original headline claim, with no
  meaningful correctness cost on instruction-following models.
- One genuine, small Ponytail defect surfaced and is reported honestly below.

## The gate bugs

1. **Unfenced code was scored as "no code blocks."** `extractBlocks()` only matched
   ```` ```fenced``` ```` blocks. Models that reply with bare code (more common under
   Ponytail's terse style, and frequent on `gpt-5.4-mini`) scored an automatic fail even
   when the code was correct. This alone accounted for 41 of 74 failures in the first GPT run.
2. **The debounce task tested the wrong deliverable.** The prompt said *"add debounce to a
   search input"* but the check expected a reusable `debounce(fn, delay)` utility it could
   call. A correct inline answer (`input.addEventListener(... clearTimeout ...)`) failed with
   `searchInput is not defined`. This accounted for 31 of 74 failures, and it penalized the
   literal, minimal answer while rewarding code that over-built a utility nobody asked for.

Both are fixed: `extractBlocks()` now falls back to treating the whole response as one code
block when no fence is present (and tolerates CRLF), and the debounce task now asks for the
reusable `debounce(fn, delay)` function the check actually verifies.

## Method

Two arms (baseline = no skill, ponytail), Pyseph's two models, the five repo tasks, `n=20`
per cell, run serially (`--max-concurrency 1`) so transient quota 429s never reduced the
denominators. Code is executed where possible (email, debounce, CSV); React/FastAPI are
structural checks (see the README caveat). Claude numbers are a free re-score of the
committed `output-10x.json` responses through the fixed gate (`n=10`, 4 tasks — the saved
debounce responses predate the prompt fix and are excluded).

## Results

### GPT-mini (clean `n=20`, 0 errors, full denominators)

| model | baseline | ponytail | median LOC (base → pony) |
|---|--:|--:|--:|
| gpt-4.1-mini | 100/100 | 100/100 | 15 → 7 |
| gpt-5.4-mini | 100/100 | 98/100 | 16 → 7 |

Pyseph's reported `gpt-4.1-mini` drop (10/15 ≈ 67%) does not reproduce — it scores 100% here.
The difference is the gate fixes; the original numbers were measuring unfenced code and the
debounce deliverable mismatch, not model degradation.

### Claude (fixed gate, re-score of committed responses, `n=10`, 4 tasks)

| model | baseline | ponytail |
|---|--:|--:|
| claude-haiku-4-5 | 38/40 (95%) | 40/40 (100%) |
| claude-opus-4-8 | 40/40 (100%) | 40/40 (100%) |
| claude-sonnet-4-6 | 28/40 (70%) | 40/40 (100%) |

On instruction-following models Ponytail ties or slightly *beats* baseline. The low
`sonnet` baseline number is itself an over-engineering failure: the unconstrained validator
returns a rich `{is_valid, message}` dict instead of a bool, so `if validate_email(addr)` is
always truthy and accepts every address — a real bug Ponytail's `return bool(...)` avoids.

## The one real Ponytail defect

On `gpt-5.4-mini`, 2 of 20 Ponytail email runs failed because the model reached for the
laziest stdlib option:

```python
from email.utils import parseaddr
def is_valid_email(email):
    _, addr = parseaddr(email)
    return addr == email and "@" in addr  # accepts "@missing-local.com"
```

`parseaddr` does not require a local part, so `"@missing-local.com"` is accepted. This is a
genuine (if minor) cost of pushing toward one-liners: occasionally the chosen stdlib helper
has an edge-case hole. The other 18 runs used a regex and passed.

## Reproduce

```bash
# GPT arms (needs OPENAI_API_KEY in ../.env)
cd benchmarks
npx promptfoo@latest eval -c promptfooconfig.gpt.yaml --env-file ../.env --repeat 20 --max-concurrency 1

# Claude re-score of committed responses through the fixed gate
node -e 'const c=require("./correctness.js"),d=require("./output-10x.json");/* score d.results.results through c */'
```

## Takeaway

The "Ponytail hurts correctness" reports trace to a benchmark that could not read terse
output, not to the skill. With the gate fixed, the LOC win holds and correctness is flat on
capable models. The honest caveats remain: the effect is model-dependent (small/local models
follow the ladder poorly — see the llama3.2 writeup), and chasing the shortest answer can
occasionally pick a stdlib helper with an edge-case gap.
