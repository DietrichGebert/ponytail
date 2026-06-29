---
name: graybeard-audit
description: "Audit the repo for stack-practice and maintainability risks. Report only."
homepage: https://github.com/allanmongej/graybeard
license: MIT
---

# Graybeard Audit

Audit the repository as a senior engineer. Start with local instructions,
manifests, framework entry points, and test setup. Then sample the highest-risk
flows instead of trying to read every file.

## Hunt

- framework patterns the repo is not following
- duplicated business rules that should live at one boundary
- missing database/type/permission constraints
- external calls without timeouts, retries, idempotency, or one wrapper boundary
- behavior paths without meaningful tests
- one-implementation abstractions, speculative config, or unnecessary dependencies

## Output

Rank findings by production risk. For each finding include evidence, why it
matters, and the smallest stack-native fix. Report only; do not edit files.
