# External DeepSWE/Pi benchmark: when lazy helps, and when it over-prunes

*2026-06-25. DeepSeek V4 Flash via OpenRouter. Pi agent harness. 113 DeepSWE tasks.*

This is an external stress test contributed by [@Whamp](https://github.com/Whamp). It is not directly comparable to Ponytail's built-in Claude Code benchmark: different harness, different model, different task distribution, and DeepSWE verifier scoring.

The useful result is the tradeoff: ponytail made the agent more decisive. That cut patch size, tokens, cost, time, and hard failures, but it also lowered mean partial reward because some easy/medium tasks were over-minimized.

## Setup

- **Harness:** [Pi](https://github.com/earendil-works/pi) running headless inside each DeepSWE task container.
- **Model:** `openrouter/deepseek/deepseek-v4-flash`.
- **Thinking:** `high`.
- **Tasks:** 113 paired [DeepSWE](https://deepswe.datacurve.ai/) repair tasks.
- **Baseline:** stock Pi, no skills, no extensions.
- **Treatment:** real Ponytail Pi extension, default/full mode.
- **Verifier:** DeepSWE held-out verifier, run air-gapped.
- **Results and harness:** <https://github.com/Whamp/deep-swe-bench>.

## Summary

Mean relative change vs the no-skill baseline:

| arm | patch lines ↓ | tokens ↓ | cost ↓ | time ↓ | partial reward ↑ | full solves ↑ |
|---|--:|--:|--:|--:|--:|--:|
| **ponytail full Pi extension** | **−26%** | **−12%** | **−10%** | **−7%** | **0.709 vs 0.774** | **4/113 vs 2/113** |

Lower is better for patch lines, tokens, cost, and time. Higher is better for DeepSWE outcomes. DeepSWE partial reward is the held-out verifier's partial score; a full solve means binary reward `1`.

Do not over-read the 2→4 full-solve count. The base rate is low. The more robust signal is the mechanical one: ponytail pruned work, which helped in some trajectories and hurt in others.

## Where ponytail helped

| success mode | count | why it is interesting |
|---|--:|---|
| Big partial wins | 16 | ponytail improved partial reward by more than 5 points |
| Cheap close-quality wins | 21 | ponytail stayed within −1 point partial, saved >500k tokens, and made a smaller patch |
| Baseline pathology rescues | 5 | baseline had an empty patch or verifier timeout; ponytail produced a real patch |
| New full solves | 3 | ponytail crossed near-threshold tasks to full binary reward |

Examples:

| task | partial reward | token delta | patch delta |
|---|--:|--:|--:|
| `mashumaro-flattened-dataclass-fields` | 0.000 → 0.998 | −1.11M | −185 lines |
| `obsidian-linter-auto-table-of-contents` | 0.634 → 0.989 | −2.26M | −674 lines |
| `prometheus-typed-label-sorting` | 0.800 → 0.889 | −4.65M | −144 lines |
| `aiomonitor-task-snapshots-diff` | 0.754 → 0.934 | −0.71M | −178 lines |

The success pattern was good pruning: fewer reads, fewer edits, smaller patch, same-or-better verifier result.

## Where ponytail regressed

Among easy/medium tasks where ponytail regressed by more than 5 partial-reward points, the common failure mode was not mostly crashes. It was over-minimization: a plausible core fix without enough tests, fixtures, exports, generated files, or downstream wiring.

| primary failure mode | n | mean Δpartial | median Δtokens | interpretation |
|---|--:|--:|--:|---|
| Omitted tests / fixtures | 7 | −0.520 | −4.62M | dropped guardrails that forced complete fixes |
| Missing wiring / exports | 6 | −0.550 | −1.64M | core fix existed, integration path was incomplete |
| Wrong layer / semantics | 5 | −0.316 | −0.51M | changed plausible files, but behavior was still wrong |

Examples:

- `actionlint-action-pinning-lint`: baseline solved it; ponytail made a much smaller source-only patch, dropped the changed test/fixture files, and fell from `1.0` to `0.0` partial reward.
- `adaptix-name-mapping-aliases`: ponytail shrank the patch from 10 files to 4 and omitted downstream name-layout/provider wiring; verifier collapsed to zero.
- `fastapi-deprecation-response-headers`: ponytail omitted public/init wiring and hit a runtime `NameError`; p2p fell to zero.
- `superjson-error-stack-serialization`: p2p stayed green, but f2p fell because public transformer/index wiring was incomplete.

The regression pattern was over-pruning: fewer edits and fewer tokens, but hidden tests failed because the integration was not complete.

## Interpretation

This run is not a clean "ponytail good" or "ponytail bad" result.

What it supports:

- ponytail can reduce patch size, cost, time, and token use in a real repair benchmark;
- ponytail can rescue baseline empty-patch and timeout failures into real implementations;
- ponytail sometimes turns near-misses into full solves;
- ponytail can also stop too early, especially on easy/medium tasks where the hidden verifier expects wiring beyond the obvious core change.

In short:

- **good pruning:** fewer edits, fewer tokens, same-or-better verifier result;
- **over-pruning:** plausible core fix, incomplete integration.

That is useful feedback for ponytail itself: the ladder's "trace the real flow end to end" rule matters as much as the "do less" rule.

## Limitations

- One model.
- One harness.
- One run per task/arm.
- Full solves are low-count: 2 vs 4 may be noise.
- DeepSWE partial reward is not ponytail's adversarial safety metric.
- Difficulty buckets use baseline partial-reward terciles, not an independent out-of-sample difficulty signal.
- This is a stress test on repair tasks, not a replacement for ponytail's Claude Code feature/safety benchmark.

## Reproduce

The harness, arm definitions, report assets, and compact summaries are in <https://github.com/Whamp/deep-swe-bench>.
