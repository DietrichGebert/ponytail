---
name: gavel-analyze
description: >
  Analyze test suite run results for any framework. Classify failures as env,
  seed, app bug, test bug, or expected fail. Produce pass-rate by area and
  ranked recommendations. Use after any test suite run.
---

# Gavel Analyze

Post-run suite analysis. Framework-adaptive.

## When to Use

- After running a full or partial test suite
- "Analyze results", "why did tests fail", "pass rate by area"

## Failure Classification

| Category | Signals | Action |
|----------|---------|--------|
| **env** | Connection refused, timeout, DNS failure | Fix env, re-run |
| **seed** | 404 on seeded data, empty grids, "not found" | Re-seed database |
| **app bug** | Assertion fails on correct test logic | File bug report |
| **test bug** | Wrong locator, stale auth, wrong config | Fix test |
| **expected fail** | Marked expected failure (test.fail, @ExpectedFailure) | Document, link bug |

## Output Template

```
## Suite Analysis -- [project] -- [date]

### Summary
| Metric | Count |
|--------|------:|
| Passed | |
| Failed (unexpected) | |
| Skipped | |
| Expected fail | |
| Duration | |

### Pass Rate by Area
| Area | Passed | Total | Rate |
|------|-------:|------:|-----:|

### Failures
| Test ID | File | Classification | Notes |
|---------|------|----------------|-------|

### Recommendations (ranked)
1. [Highest impact action]
```
