# Benchmark Scope and Methodology

Ponytail's benchmarks measure code generation on specific task types. This
document clarifies what the numbers mean, where they apply, and where they
don't — extending the honest-limitations culture established in
`benchmarks/results/`.

## Task-type dependency

Ponytail's wins are largest on **over-build traps** — tasks where the naive
approach produces unnecessary code:

| Task type | Typical LOC reduction | Why |
|-----------|----------------------|-----|
| Native replacement (date picker, modal, validation) | 50-95% | Platform feature replaces library + custom code |
| Stdlib substitution (CSV parsing, grouping, cloning) | 70-90% | One stdlib call replaces multi-line implementation |
| Irreducible CRUD (REST endpoints, form handling) | 0-15% | Both approaches converge on similar code |
| Complex algorithms | ~0% | No shortcut exists; ponytail correctly doesn't invent one |

The published -54% LOC (agentic) and 80-94% (single-shot) numbers are
dominated by over-build-trap tasks. Extrapolating to all code generation
overstates the effect.

## Model-specific cost behavior

| Model family | Cost impact | Source |
|-------------|-------------|--------|
| Claude (Haiku, Sonnet) | 42-75% cheaper | Published benchmarks |
| OpenAI reasoning (gpt-5.4-mini) | ~26% MORE expensive | Robustness audit |
| OpenAI reasoning (gpt-5.5) | ~39% MORE expensive | Robustness audit |
| Small local (llama3.2) | No measurable effect | Local model benchmark |

The cost savings are **Claude-specific**. On OpenAI reasoning models, ponytail's
questioning and ladder-climbing generate more reasoning tokens than the naive
approach saves in output tokens.

## Independent evaluation findings

An independent evaluation using blind multi-agent experiments (10 reviewers,
4-lens council) found:

- **Signal density:** ponytail-review produces ~3.2x more findings per unit of
  output compared to unstructured review — directionally correct, slightly
  below the 3.5x initially estimated
- **Structural blind spot:** Tag-and-line format misses structural YAGNI
  (wrapper layers, unnecessary abstractions) — addressable with hybrid output
- **Ultra uniqueness:** In a multi-agent council, ponytail-ultra produced 0
  unique findings beyond what an unstructured simplify lens caught
- **Safety:** 100% maintained across 90+ runs and 14 targeted probes

## Evaluation methodology recommendations

When evaluating ponytail (or any agent tool) for integration:

1. **Use independent test material.** Ponytail's own showcase examples
   (email-validation, rate-limit, etc.) are selected to demonstrate strengths.
   Use your project's actual code for evaluation.
2. **Blind comparisons.** Run reviewers independently without seeing each
   other's output. Single-agent simulation (one agent playing multiple roles)
   overstates differences.
3. **Check for false negatives.** A tool that reports "clean" is only useful if
   the code actually is clean. Test against code with known issues.
4. **Model-match your evaluation.** Results on Claude don't predict results on
   GPT or local models.
