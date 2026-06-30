---
name: gavel-close
description: >
  Write Jira/issue tracker closure summaries after QA verification. Use when
  QA testing is complete and you need to produce a closure comment for the
  ticket before closing it.
---

# Gavel Close

QA closure summaries for issue trackers.

## When to Use

- QA testing is complete for a ticket
- Need to document what was tested and the results
- Closing a bug fix or feature ticket

## Template

```
QA Closure Summary -- [TICKET-ID]
=================================================================================

Verified by: [QA engineer / automated test]
Date: [date]
Environment: [env URL / local]

Tests Executed
--------------
| Test ID | Description | Result |
|---------|-------------|--------|
| [ID] | [description] | PASS/FAIL |

Coverage
--------
- Happy path: [tested/not tested]
- Edge cases: [tested/not tested]
- Regression: [tested/not tested]

Notes
-----
[Any observations, follow-up items, or known limitations]

Verdict: PASS -- closing ticket.
```
