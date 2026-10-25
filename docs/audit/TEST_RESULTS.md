# Ponytail Test Results — 2026-10-25

Machine: Windows 10 (win32), Node v24.19.0, npm 11.17.0. Clone at `09c434a` (v5.3.2); second pass at `13367a1` + F-2 fix (uncommitted until this pass's commit).

## Commands and outcomes

| Command | Outcome |
|---|---|
| `npm test` (root: `node --test tests/*.test.js && npm test --prefix pi-extension`) | exit 1 — root: **145 tests, 144 pass, 1 fail**; the `&&` chain then skipped the prefix suite |
| Failing test (pre-fix and post-fix, both environmental) | `csv: correct pandas one-liner passes` — no local python has pandas; CI declares it (`.github/workflows/test.yml: pip install pandas`). Pre-fix failure mode: Python `ModuleNotFoundError` traceback in `reason`. Post-fix: clear `'pandas is not installed for python3 or python; the csv check needs it (CI runs: pip install pandas)'`. Passes on any machine with pandas — the gate never fires there. |
| `npm test --prefix pi-extension` (run explicitly) | **30/30 pass**, exit 0 |
| `node --test tests/correctness.test.js` (focused, post-fix) | 18 tests — **17 pass, 1 fail** (the same environmental one); new regression test passes |
| `node scripts/check-rule-copies.js` | PASS — "Rule copies match AGENTS.md; 10 rule invariants present in SKILL.md and AGENTS.md." |
| `node scripts/check-versions.js` | PASS — "All 7 version files pinned at 5.3.2." |
| `npm pack --dry-run` | OK — 46 files; integrity sha512 recorded; contents match `package.json#files` |
| Live hook smoke (isolated `CLAUDE_CONFIG_DIR`): activate / statusline.ps1 / map / mode-tracker | all exit 0, correct outputs (AUDIT_REPORT §3) |

## Second pass (2026-10-25, REA + challenge)

| Command | Outcome |
|---|---|
| `node --test tests/*.test.js` | **150 tests — 149 pass, 1 fail** (same environmental pandas test; +5 new publish-safety tests all pass) |
| `npm test --prefix pi-extension` | **30/30 pass** |
| `node --test tests/publish-args-safety.test.js` | **5/5 pass** (import-safety, allowlist accepts, 8 injection vectors refused, quote display, displayName) |
| `node scripts/check-rule-copies.js` / `check-versions.js` | PASS / PASS (unchanged) |
| `npm pack --dry-run` | OK — 46 files (publish script is not shipped; fix affects maintainer tooling only) |
| Dependency-absent path (live) | `correctness()` on a pandas-importing submission returns the clear dependency message — verified by direct call this pass |
| Dependency-present path | Not executable on this machine (would require installing pandas — not authorized); the gate is a two-clause boolean whose false-branch is the previously shipped CI-green behavior; CI runs it on every push |
| REA | `analyze-javascript-application` on shipped tarball: ran, 0 parse failures, 0 integrity contradictions (see AUDIT_REPORT §REA verification) |

## Regression coverage added

`tests/correctness.test.js` — `csv: missing pandas reports the dependency, not a harness traceback` (first pass);
`tests/publish-args-safety.test.js` — 5 tests covering the F-2 publish-argument allowlist (second pass): forces the no-pandas probe state via the new `resetPythonProbe('python', false)` seam, asserts `pass === false` and `reason` names pandas, restores the live probe in `finally`.

## Pre-existing vs introduced

- Pre-existing environmental failure: 1 (the csv/pandas test — unchanged in count post-fix).
- Regressions introduced during the fix: none remaining. (An initial over-broad gate briefly broke the #919 exception-surfacing and timeout tests on no-pandas machines; caught by the suite, fixed by scoping the gate to code that imports pandas; both tests pass again locally.)

## Skipped checks and why

- pandas installation into the user's Python — system change, not silently authorized; the environmental failure is documented instead.
- CI execution (GitHub Actions) — requires push; not authorized.
- Any deployment/publish — not authorized.
- Coverage tooling — not configured in-repo; not added (zero-dep project).
