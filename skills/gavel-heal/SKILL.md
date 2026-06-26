---
name: gavel-heal
description: Diagnose a failing test. Is it a test bug, app bug, or env issue? Runs a structured diagnostic workflow and returns a verdict with evidence. Framework-adaptive — uses the correct debugging tools per active profile.
---

# Gavel Heal

Diagnose a single failing test. Return a verdict. Do NOT fix — just diagnose.

## When to Use

- A test fails and you don't know why
- You need to determine: test bug vs app bug vs env issue
- Before calling gavel-healer (fix) or gavel-bug (report)

## Diagnostic Workflow

### Step 1: Capture the error

Run the test in isolation:
```bash
# Playwright
npx playwright test <spec> -g "<test-name>" --reporter=list

# pytest
pytest <path> -k "<test-name>" -v

# JUnit/TestNG
mvn test -Dtest=<TestClass>#<method>

# Cypress
npx cypress run --spec <spec> --grep "<test-name>"

# WebdriverIO
npx wdio run wdio.conf.ts --spec <spec>
```

Capture: error message, stack trace, screenshot/trace path.

### Step 2: Classify the failure

| Error Pattern | Category | Confidence |
|---------------|----------|------------|
| Element not found / TimeoutError / NoSuchElement | Locator changed | High |
| Expected X, received Y | Assertion mismatch | High |
| 401 / 403 / Token expired | Auth issue | High |
| ECONNREFUSED / 502 / 503 | Environment down | High |
| Intermittent (passes on retry) | Flaky — hand to gavel-flake | Medium |
| Different error than expected | Regression — escalate | Low |

### Step 3: Verify the category

For **locator issues**: inspect the live DOM (browser tools, screenshot, trace). Is the element there with a different selector, or truly gone?

For **auth issues**: check token generation, env vars, fixture setup. Is the test data valid?

For **env issues**: check if the app/service is running. Check env vars and config.

For **assertion mismatch**: read the actual vs expected. Is the test wrong or the app wrong?

### Step 4: Verdict

Output one of:

| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| **TEST BUG** | Test is wrong (bad locator, wrong assertion, stale data) | → gavel-healer to fix |
| **APP BUG** | App is broken (feature not working, regression) | → gavel-bug to report |
| **ENV ISSUE** | Environment is misconfigured or down | → gavel-env to fix |
| **FLAKY** | Intermittent — passes sometimes | → gavel-flake to investigate |
| **AMBIGUOUS** | Cannot determine with evidence | → escalate to user |

## Output Format

```markdown
## Diagnosis: <TEST BUG | APP BUG | ENV ISSUE | FLAKY | AMBIGUOUS>

**Test:** <test-name>
**File:** <spec-path>
**Error:** <exact error message>
**Category:** <locator | assertion | auth | env | data | timing>

### Evidence
- <bullet 1: what the error says>
- <bullet 2: what the DOM/response shows>
- <bullet 3: what you checked to confirm>

### Recommended next step
→ <agent/skill to call>
```

## Rules

- One test at a time. Do NOT diagnose a whole suite — that's gavel-analyze.
- Evidence-based. Every verdict must have proof (error message, screenshot, trace).
- Do NOT fix. Diagnosis only. Fix is gavel-healer's job.
- Do NOT report bugs. That's gavel-bug's job.
- If you can't determine the category, say AMBIGUOUS and explain why.
