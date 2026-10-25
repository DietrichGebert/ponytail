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
| `node --test tests/*.test.js` | **153 tests — 152 pass, 1 fail** (same environmental pandas test; +8 publish-safety tests all pass) |
| `npm test --prefix pi-extension` | **30/30 pass** |
| `node --test tests/publish-args-safety.test.js` | **8/8 pass** (import-safety; allowlist accepts; 8 known injection vectors + 15 derived boundary/encoding classes refused; structural single-spawn/validated-first/no-eval guard; all arg sources covered incl. version + displayName charset proof; quote display; displayName) |
| `node scripts/check-rule-copies.js` / `check-versions.js` | PASS / PASS (unchanged) |
| `npm pack --dry-run` | OK — 46 files (publish script is not shipped; fix affects maintainer tooling only) |
| Dependency-absent path (live) | `correctness()` on a pandas-importing submission returns the clear dependency message — verified by direct call this pass |
| Dependency-present path | Not executable on this machine (would require installing pandas — not authorized); the gate is a two-clause boolean whose false-branch is the previously shipped CI-green behavior; CI runs it on every push |
| REA | `analyze-javascript-application` on shipped tarball: ran, 0 parse failures, 0 integrity contradictions (see AUDIT_REPORT §REA verification) |

## Third pass (2026-10-25, independent patch verification)

- Independent boundary derivation (not payload-list-based): 32 shell-relevant character/payload classes tested against `SAFE_ARG` — all blocked; `quote()` proven unable to be terminated early or escaped (its content can never contain `"` or `\`, both outside the allowlist); exactly 1 `spawnSync` site, 0 `eval`/`Function`, `args.forEach(assertSafeArg)` textually precedes the spawn; `...passthrough` flows through the same validated array.
- Windows behavior: `shell:true` on win32 resolves to `cmd.exe` (COMSPEC); `%`, `^`, `!`, `&` all blocked — no cmd.exe expansion/separator path exists through allowlisted chars. (POSIX sh: `$`, backtick, `;`, `|`, `&`, `<`, `>`, `()`, newline all blocked.)
- `npm test` full chain: exit 1 — root **153/152/1** (the environmental pandas test; the `&&` chain then skips pi, as documented in F-3), `npm test --prefix pi-extension` run separately: **30/30**.
- `check-rule-copies.js` PASS · `check-versions.js` PASS (7 files @ 5.3.2) · `npm pack --dry-run`: **46 files**, no maintainer scripts/tests/audit docs in the package (grep-verified).

## Fourth pass (2026-10-25, pandas resolved in an isolated venv — no system Python touched)

`python -m venv /c/tmp/ponytail-audit/venv-pandas && venv pip install pandas` (pandas 3.1.0, Python 3.11.4), then the suites with the venv's python first on PATH:

| Command | Outcome |
|---|---|
| `node --test tests/correctness.test.js` | **18/18 pass** — the pandas-present path of F-1 now exercised end-to-end locally |
| `node --test tests/*.test.js` | **153/153 pass, exit 0** — fully green |
| `npm test` (full chain: root && pi) | **exit 0 — root 153/153, pi 30/30** |

The one previously "environmental" failure is resolved **without modifying system Python** (isolated venv, outside the repo, discardable). Upstream CI (read-only API check) has not run on our commits — they are local-only; recent upstream runs show `action_required` (the repo's external-PR approval gate).

## Regression coverage added

`tests/correctness.test.js` — `csv: missing pandas reports the dependency, not a harness traceback` (first pass);
`tests/publish-args-safety.test.js` — 8 tests covering the F-2 publish-argument allowlist (second pass: 5; third pass: +3 — derived boundary classes, structural single-spawn guard, arg-source coverage): forces the no-pandas probe state via the new `resetPythonProbe('python', false)` seam, asserts `pass === false` and `reason` names pandas, restores the live probe in `finally`.

## Pre-existing vs introduced

- Pre-existing environmental failure: 1 (the csv/pandas test — unchanged in count post-fix).
- Regressions introduced during the fix: none remaining. (An initial over-broad gate briefly broke the #919 exception-surfacing and timeout tests on no-pandas machines; caught by the suite, fixed by scoping the gate to code that imports pandas; both tests pass again locally.)

## Skipped checks and why

- pandas installation into the user's Python — system change, not silently authorized; the environmental failure is documented instead.
- CI execution (GitHub Actions) — requires push; not authorized.
- Any deployment/publish — not authorized.
- Coverage tooling — not configured in-repo; not added (zero-dep project).
