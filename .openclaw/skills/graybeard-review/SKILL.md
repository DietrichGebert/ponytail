---
name: graybeard-review
description: "Review a diff for stack fit, boundary risks, missing proof, and needless complexity. Report only."
homepage: https://github.com/allanmongej/graybeard
license: MIT
---

# Graybeard Review

Review the current diff or requested target. Read the touched files, callers,
tests, manifests, and local instructions needed to prove each finding.

## Findings

Lead with active risks only:

- stack mismatch or framework misuse
- boundary leaks or one-off abstractions
- missing durable constraints for data, auth, idempotency, or permissions
- security, privacy, data loss, accessibility, or rollback risk
- behavior changes without meaningful automated proof
- dependencies or background machinery that the current requirement does not earn

## Output

Findings first, ordered by severity:

`[severity][confidence] file:line - issue. Fix: concrete action.`

If there are no findings, say that clearly and name any residual test gap.
Report only; do not edit files.
