---
name: gavel-bug
description: >
  Writes standardized bug reports after an automated test exposes a real bug.
  Use when confirming a test failure is a genuine product defect and you need
  to produce a bug report for the dev team and issue tracker.
---

# Gavel Bug

Standardized bug reporting from test failures.

## When to Use

Invoke when ALL are true:
- An automated test has failed
- The failure is confirmed as a real bug (not flaky/env/test issue)
- The bug needs documentation for a developer to fix

Do NOT use for: test-side problems, missing docs, speculative issues.

## Mandatory Template

```
[TICKET-ID]: <general title describing root cause, not the scenario>
=================================================================================

Issue Tracker: <URL or "Not yet filed">
Repo: <repository name>
Severity: Low | Medium | High | Critical
Found by: Automated test (<path-to-spec>)

Description
-----------
<2-4 sentences explaining the bug. State the contract violated.>

Steps to Reproduce
------------------
1. <precondition>
2. <action>
3. <observation>

Observed Result
---------------
<exact behavior, status codes, response bodies>

Expected Result
---------------
<what should happen per the contract>

Test Failure Location
---------------------
<relative spec path>:<line>

Backend Code Location
---------------------
**Primary: File [function_name](file:///path/to/file#L<start>-L<end>)**
<2-4 sentences explaining WHY this code is the culprit.>

Fix Recommendation
------------------
<what the dev should change. Don't prescribe exact code unless trivial.>

Workaround
----------
<what users/QA can do until fixed, or "None currently available".>
```

## Quality Checks

1. Title is general (describes class of bug, not specific test data)
2. Backend Code Location points to source code, NOT the test
3. Line ranges are real (verify by reading the file)
4. One bug per report
