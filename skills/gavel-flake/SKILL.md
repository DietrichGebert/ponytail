---
name: gavel-flake
description: Flaky test triage. Diagnose race conditions, shared state, timing issues, and order-dependent tests. Produces a flake report with root cause and fix recommendation. Framework-adaptive.
---

# Gavel Flake

Hunt flaky tests. Find the root cause. Recommend a fix. Do NOT silently retry.

## When to Use

- A test passes sometimes and fails sometimes
- CI shows intermittent failures
- You suspect race conditions or shared state
- A test was marked with `test.fail()` or `@xfail` "temporarily"

## Flake Taxonomy

| Category | Symptom | Root Cause |
|----------|---------|------------|
| **Race condition** | Pass/fail depends on timing | Async operations not awaited properly |
| **Shared state** | Pass alone, fail in suite | Tests share DB, files, or global state |
| **Order-dependent** | Pass in order A, fail in order B | Test depends on side effects from another test |
| **Network timing** | Fails on slow CI, passes locally | Hardcoded timeouts too tight |
| **DOM timing** | Element appears after assertion | Missing wait for render/animation |
| **Data leak** | Fails on second run | Test doesn't clean up its data |
| **Auth expiry** | Fails after N minutes | Token expires mid-suite |
| **Resource contention** | Fails with parallel workers | Tests compete for same resource |

## Diagnostic Workflow

### Step 1: Reproduce

Run the test multiple times to confirm flakiness:
```bash
# Playwright — run 5 times
for i in {1..5}; do npx playwright test <spec> -g "<name>"; done

# pytest — run with count plugin
pytest <path> -k "<name>" --count=5

# JUnit — run in a loop
for i in {1..5}; do mvn test -Dtest=<TestClass>#<method>; done
```

Record: pass count, fail count, failure messages.

### Step 2: Isolate

Run the test alone vs in-suite:
- **Passes alone, fails in suite** → shared state or order dependency
- **Fails alone and in suite** → timing or race condition
- **Fails only with N workers** → resource contention

### Step 3: Categorize

Based on isolation results + error messages, assign a category from the taxonomy above.

### Step 4: Root cause

For each category:

| Category | Investigation |
|----------|---------------|
| Race condition | Check for missing `await`, `waitFor`, or explicit waits |
| Shared state | Check for shared DB rows, global variables, singleton services |
| Order-dependent | Run in reverse order; check for test.setup side effects |
| Network timing | Check timeout values; compare local vs CI latency |
| DOM timing | Check for animations, lazy loading, deferred rendering |
| Data leak | Check AfterEach/AfterAll cleanup; verify factory teardown |
| Auth expiry | Check token TTL vs suite duration |
| Resource contention | Check for shared files, DB connections, browser contexts |

### Step 5: Verdict

```markdown
## Flake Report

**Test:** <test-name>
**File:** <spec-path>
**Category:** <race | shared-state | order-dependent | network | DOM | data-leak | auth | contention>
**Reproduction rate:** <X/Y runs failed>

### Root Cause
<explanation with evidence>

### Recommended Fix
<specific fix — e.g., "Add explicit wait for element X", "Move factory cleanup to AfterEach", "Increase worker timeout to 30s">

### Confidence
<HIGH | MEDIUM | LOW>
```

## Rules

- Do NOT retry silently. Flaky tests are bugs — they need diagnosis, not retries.
- Do NOT add `test.fail()` or `@xfail` to hide flakiness.
- Do NOT increase timeouts as the first fix — find the real cause.
- Reproduce before diagnosing. Need at least 3 runs to confirm flakiness.
- One test at a time. Do NOT triage a whole suite — that's gavel-analyze.
