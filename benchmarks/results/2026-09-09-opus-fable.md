# Opus 5 / Fable 5.1: single-shot benchmark

## Results

**60 matrix attempts produced 55 returned responses and five 180-second
timeouts.** Opus returned 30/30; Fable returned 25/30. All returned responses
reported the requested exact model ID. No failed cell was retried or replaced.
The [publishable response/telemetry artifact](2026-09-09-opus-fable.json)
includes all 60 attempts, original-text hashes, metric results, and disclosed
identifier redactions. A returned response is not necessarily a solved task.

Known CLI-estimated cost is **$1.485330**, including $0.001919 for the two setup
probes. The five interrupted calls have **unknown cost**. Their combined $2.00
reservation is bookkeeping, not a verified cost or upper bound. No claim about
the final invoiced total is possible from the retained telemetry.

### Completed-response telemetry only

Every statistic below excludes timeouts and uses the explicit returned-response
denominator `n`. It is **not** an overall latency, cost, or reliability result.
Output tokens use the requested model's `modelUsage.outputTokens`; CLI cost
includes its recorded auxiliary-model overhead. Durations are the CLI's
`duration_ms`, not independently measured wall time.

| Model / arm | Returned / attempted | Median output tokens | Median CLI seconds | Mean CLI USD / returned response |
|---|---:|---:|---:|---:|
| Opus 5 baseline | 15/15 | 229 | 4.611 | 0.016082 |
| Opus 5 Ponytail | 15/15 | 333 | 5.655 | 0.017899 |
| Fable 5.1 baseline | 13/15 | 977 | 10.922 | 0.046679 |
| Fable 5.1 Ponytail | 12/15 | 326 | 6.201 | 0.030573 |

The failures remain in the attempted denominators: Fable baseline React
repetitions 2 and 3; Fable Ponytail debounce repetition 2; Fable Ponytail
rate-limit repetitions 1 and 3. Each stopped at the unchanged 180-second limit.

### Existing LOC and lightweight gate results

LOC is the existing counter's raw median, with returned-response `n` shown in
parentheses. The fenced and gate columns show baseline → Ponytail counts over
their respective returned-response denominators. A cell can have fewer than
three returned responses because its timeout is retained, not imputed as zero LOC.

| Model / task | Baseline raw LOC (n) | Ponytail raw LOC (n) | Fenced responses B → P | Gate passes B → P |
|---|---:|---:|---:|---:|
| Opus / email | 34 (3) | 10 (3) | 3/3 → 3/3 | 3/3 → 3/3 |
| Opus / debounce | 2 (3) | 5 (3) | 0/3 → 3/3 | 0/3 → 0/3 |
| Opus / CSV sum | 9 (3) | 4 (3) | 2/3 → 3/3 | 2/3 → 3/3 |
| Opus / React countdown | 7 (3) | 17 (3) | 2/3 → 2/3 | 0/3 → 1/3 |
| Opus / rate limit | 5 (3) | 12 (3) | 1/3 → 2/3 | 1/3 → 2/3 |
| Fable / email | 50 (3) | 10 (3) | 3/3 → 3/3 | 3/3 → 3/3 |
| Fable / debounce | 9 (3) | 6.5 (2) | 2/3 → 1/2 | 1/3 → 0/2 |
| Fable / CSV sum | 12 (3) | 3 (3) | 3/3 → 3/3 | 3/3 → 3/3 |
| Fable / React countdown | 25 (1) | 10 (3) | 0/1 → 1/3 | 0/1 → 2/3 |
| Fable / rate limit | 10 (3) | 13 (1) | 2/3 → 0/1 | 0/3 → 1/1 |

There are **16 whole-response LOC fallbacks among 55 returned responses**.
Several are inspection promises or plain-text tool-call imitations instead of
standalone solutions. Tools were disabled; those strings were not executed by
Claude. Some structural gates still pass code embedded in that text. Consequently
these LOC medians do **not** justify a headline code-reduction percentage, and
the 31/55 gate passes (31/60 attempted cells) are not a production-correctness claim.

The narrow email task does show shorter fenced responses with Ponytail while
both arms pass the existing five-address check, at three repetitions per cell.
That observation should not be generalized to the other tasks or agentic work.

Offline regrading in the pandas-equipped environment changed **zero** pass/fail
outcomes. Five responses had operator-like identifiers edited; every edit
preserved the original LOC and the original lightweight gate's pass/score.

## Method

This is a text-generation comparison, not a repository-editing agent benchmark,
plugin-installation test, or safety/security evaluation. It reuses the five
unchanged tasks in `benchmarks/prompts.json` and the unchanged `loc.js` and
`correctness.js` metrics. The intended matrix is five tasks × two arms × two
models × three repetitions (60 attempts). Calls run sequentially; the runner
does not retry failed samples or select a fallback model. A timeout remains a
failed sample while unattempted cells may proceed.

- Models requested: `claude-opus-5`, `claude-fable-5-1`; each successful response
  must contain its requested model in `modelUsage`.
- Claude Code: `2.1.266`; effort: `medium`; Node.js: `26.5.0`; macOS arm64.
- Source: `356918eba965ee1eac64bd3a7f0dd02108350de5`.
- Ponytail arm: the complete `skills/ponytail/SKILL.md`, including frontmatter,
  SHA-256 `1316a2f3f95741d2300b116fe0c2d81ce4a9568656ed0a62643f54aaf09957f2`.
- Baseline arm: `--system-prompt ''`. This removes the default coding prompt;
  it does **not** remove the CLI's billing header, SDK identity, date reminder,
  or runtime token-budget metadata. These host additions are shared by both arms.

Each call starts in a fresh temporary directory with `--safe-mode`, no tools,
disabled skills/slash commands, strict MCP configuration, no session persistence,
JSON output, a 180-second timeout, and a $0.40 per-call CLI budget. The total
estimated-cost budget is $8, including unsuccessful setup probes. The runner
reserves $0.40 before starting another call. Authentication uses the already
configured Claude CLI; no credentials are copied into the artifacts.
An interrupted call without JSON telemetry has unknown cost: its $0.40 budget
reservation is not a verified fee or a guaranteed upper bound on a single API call.

## Baseline protocol check

Two initial email probes used a single space as the custom system prompt. Both
returned API 400: `system: text content blocks must contain non-whitespace text`.
They produced no task response and are excluded from the 60-sample matrix.
Their CLI-estimated costs ($0.000957 and $0.000962; $0.001919 total) are retained
in [the setup artifact](2026-09-09-opus-fable-probes.json). Its `modelUsage`
contains only an auxiliary Haiku request; these failures do not establish whether
either requested model was available.

A local HTTP endpoint, dummy API key, and error response were then used to inspect
the outgoing request without calling a paid model. Both `--bare` and `--safe-mode`
preserve the empty-string override: the baseline had only the two fixed host
system blocks (74 and 62 characters), while the Ponytail arm added the exact
6,616-character skill. Both had zero tools and the same host message metadata.
An additional probe with the inherited environment and the real email task found
no email addresses or account identifiers in either outgoing body. The endpoint
did not log authentication headers. These checks verify client-side request
construction, not undisclosed server-side processing.

## Reproduce

Inspect the dry run and run the no-cost argument check first:

```sh
node benchmarks/claude-cli.mjs
node benchmarks/claude-cli.mjs --self-check
node --test benchmarks/loc.test.js benchmarks/correctness.test.js
```

With a configured Claude CLI and the benchmark's Python/pandas prerequisites:

```sh
node benchmarks/claude-cli.mjs --run --output /tmp/opus-fable-new-run.json
```

To repeat the offline grading without making model calls, prepare a temporary
environment with Python 3.14.6 and pandas 3.0.5, put its `bin` directory first on
`PATH`, and run:

```sh
node benchmarks/claude-cli.mjs --grade /tmp/opus-fable-new-run.json --output /tmp/opus-fable-graded.json
```

The first pass used the system Python without pandas. The published artifact
retains `initialCorrectness` and applies the same, unmodified gate to every
original response in the pandas-equipped environment. No responses are
regenerated and no model calls are made during this step. `hasFencedCode`
distinguishes the LOC counter's fenced-code case from its whole-response fallback.

`--probe` limits this to one baseline email call per model. The output path must
not already exist. `--run` incurs usage; the default command does not. Usage and
cost fields are CLI telemetry at list-price estimates, not an invoice or proof
of subscription billing. Auxiliary Haiku usage is retained separately in
`modelUsage` and included in the CLI total.

`--resume <prior-raw.json>` skips every previously attempted cell, including
failures, checks the skill hash and task text, carries forward known cost and
unknown-cost reservations, and requires a new output file. It does not fill
missing successful repetitions by retrying a failed attempt.

## Interpretation limits

- Three repetitions per cell cannot establish statistical significance or
  generalize to repositories, longer tasks, other effort settings, or other models.
- Order is not randomized. The resumed portion runs previously unattempted Fable
  cells after the Opus cells; service load and cache state can affect timing.
  Successful-response latency medians exclude timeouts and are not throughput
  or reliability measurements.
- LOC counts nonblank, noncomment lines in fenced blocks. If no fence exists,
  it counts the entire response, including clarification questions and prose.
  It is therefore not an AST statement count or an overall quality score.
- The email check covers five simple addresses, not RFC compliance. Debounce
  runs extracted code in bare Node; DOM-dependent examples can fail without a
  browser even when their browser integration is plausible. CSV checks one
  three-row input with a sum of 351. The React and FastAPI checks are only
  structural/keyword probes, not runtime or security validation.
- A failed lightweight gate is reported as such, not automatically a model bug.
  A shorter answer is not treated as a correctness or safety improvement.
- Model-generated examples resembling operator information are replaced in
  the publishable artifact without changing line counts. Metrics are measured
  from the original response; any such replacements are disclosed in the artifact.
  Original and published response-text SHA-256 hashes are included. The edited
  text is not byte-for-byte raw output. The original and edited text are both
  evaluated with the same gate, and pass/score equality is checked; that does
  not prove full semantic equivalence beyond the lightweight probe.
