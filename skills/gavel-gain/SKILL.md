---
name: gavel-gain
description: >
  Show gavel's test quality impact as a compact scoreboard: pass rate, coverage
  delta, flake count, LOC per test. One-shot display, not a persistent mode.
  Trigger: /gavel-gain, "gavel gain", "show test quality", "gavel scoreboard",
  "how are my tests doing".
---

# Gavel Gain

Display this scoreboard when invoked. One-shot: do NOT change mode, write flag
files, or persist anything.

The figures come from the current repo's test run results, not benchmarks.
Parse the latest test report (Playwright JSON, pytest JUnit XML, etc.) to
compute real metrics.

## Scoreboard

Render plain ASCII:

```
  gavel gain                        test quality scoreboard

  Tests           total: <N>  passed: <P>  failed: <F>  skipped: <S>
  Pass rate       ████████████████████  <P/N * 100>%
  Flake count     <flaky tests identified in last N runs>
  LOC per test    <avg lines per test file>
  Constitution    <violations found by last /gavel-audit>
  Coverage delta  <new tests added vs removed since last run>

  This repo:  /gavel-debt   (deferrals you marked)
              /gavel-audit  (what's still cuttable)
              /gavel-review (diff-level violations)
```

## Per-Framework Parsing

- **Playwright**: parse `test-results/*.json` or `--reporter=json` output
- **pytest**: parse JUnit XML from `--junitxml` or `pytest-json-report`
- **JUnit/TestNG**: parse Surefire/Failsafe XML reports
- **Cypress**: parse `cypress/results/*.json` from `cypress-multi-reporter`
- **WebdriverIO**: parse `wdio` reporter output

## Honesty boundary

These are real numbers from the current repo, not benchmarks. If no test
results are found, say so: `No test results found. Run your suite first.`

NEVER fabricate metrics. If the data isn't there, say so.

## Boundaries

One-shot display. Edits nothing, changes no mode.
"stop gavel" or "normal mode": revert.
