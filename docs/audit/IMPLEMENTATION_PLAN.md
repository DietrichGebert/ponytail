# Ponytail Implementation Plan — 2026-10-25

## Completed this audit

| Item | Evidence |
|---|---|
| F-1 fix: csv-check pandas diagnosability (probe records `pythonHasPandas`; pandas-importing code fails fast with a dependency-naming reason; non-pandas code still executes) | `benchmarks/correctness.js` (+18/−3), `tests/correctness.test.js` (+19), regression test green, focused suite 17/18 (1 environmental), full root 144/145, pi 30/30 |
| Deliverables written | `docs/audit/{AUDIT_REPORT,SECURITY_REVIEW,TEST_RESULTS,IMPLEMENTATION_PLAN}.md` |

## Backlog (all P3; none blocks use, release, or publication)

| ID | Item | Why deferred |
|---|---|---|
| B-1 | Run the suite on a machine (or CI) with pandas to exercise the pandas-present path of F-1 end-to-end | Requires push to CI or a local pandas install; the gate logic is a two-clause boolean whose false-branch is the previously shipped behavior, and CI runs it on every push anyway |
| B-2 | i18n README translations (`i18n/README.*.md`) may lag the English README | No tooling asserts translation freshness; content drift is documentation-only; `check-versions.js` already pins the version mentions |
| B-3 | `npm test` chain effect: a root failure masks the pi-extension suite locally | By-design `&&` semantics; CI is green on both; documented in TEST_RESULTS.md |
| B-4 | Publish-script `quote()` is not a full POSIX escaper | Maintainer-only, unshipped, self-typed args (SECURITY_REVIEW R-1) |

## Explicitly not planned

- No refactor of the 20 agent adapters (each is a thin, per-platform manifest; `check-rule-copies`/`check-versions` pin their sync).
- No new dependencies, scanners, or CI jobs (the package's differentiator is zero runtime deps).
- No changes to skills wording (rule copies verified invariant).

## Next action for a maintainer

Review the 2-file diff (`benchmarks/correctness.js`, `tests/correctness.test.js`) + the four `docs/audit/*.md` files in the local commit; push when satisfied — CI (`pandas` + both suites) is the authoritative green gate.
