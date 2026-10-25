# Ponytail Audit — 2026-10-25

Auditor: autonomous staff-engineer pass per the master-mission brief.
Scope: full repository at `09c434a` (v5.3.2), fresh clone, clean tree.
Deliverables: this report, `SECURITY_REVIEW.md`, `TEST_RESULTS.md`, `IMPLEMENTATION_PLAN.md` (same directory).

## 1. What this repository is

Ponytail is a zero-runtime-dependency npm package + multi-agent plugin that injects a "lazy senior developer" ruleset into ~20 AI coding agents (Claude Code, Codex, Cursor, Copilot, OpenCode, pi, Hermes, Qoder, Grok, Kimi, Windsurf, …). Shipped surface: `hooks/*.js` (session/prompt/subagent hooks), `skills/*/SKILL.md` (6 skills), `.opencode/plugins/ponytail.mjs` (npm main), `pi-extension/index.js`, `scripts/{uninstall,cursor-hooks}.js`, `hooks/band/*` (a Claude Code statusline board module). Benchmarks and the 20 adapter directories are repo-internal tooling/config.

## 2. Baseline (before any change)

| Check | Result |
|---|---|
| Root suite `npm test` (`node --test tests/*.test.js`) | 144 tests — **143 pass, 1 fail** |
| Failing test | `csv: correct pandas one-liner passes` — **environmental**: no `python`/`python3` on this machine has pandas; CI installs it (`.github/workflows/test.yml:27 pip install pandas`) |
| pi-extension suite (`npm test --prefix pi-extension`) | **30/30 pass** (was masked locally before: the `&&` chain stopped at the root failure) |
| `node scripts/check-rule-copies.js` | PASS — rule copies match AGENTS.md, 10 invariants present |
| `node scripts/check-versions.js` | PASS — 7 version files pinned at 5.3.2 |
| `npm pack --dry-run` | 46 files, matches `package.json#files` |
| Working tree | clean clone, no user changes to preserve |
| Runtime dependencies | **zero** (no `dependencies` field) |

## 3. Live reliability smoke tests (Windows, this machine)

Executed directly, isolated `CLAUDE_CONFIG_DIR`:

- `ponytail-activate.js` → exit 0; writes `.ponytail-active` (`full`), copies statusline script (symlink-safe temp+rename), emits ruleset. PASS
- `ponytail-statusline.ps1` → exit 0, ANSI badge `[PONYTAIL]`. PASS
- `ponytail-map.js` → exit 0, correct codebase map of this repo within budget. PASS
- `ponytail-mode-tracker.js` with `{"prompt":"/ponytail ultra"}` → flag updated to `ultra`, mode-change notice emitted. PASS

## 4. Findings

**No P0, P1, or P2 defects found.** Confirmed items:

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-1 | P3 (fixed) | `benchmarks/correctness.js` csv check: on a machine whose pythons all lack pandas, pandas-importing submissions failed with a `ModuleNotFoundError` traceback buried in `reason` instead of naming the missing dependency — the python probe's fallback (`import sys`) masked the real gap. Root cause at the producing boundary (probe), not at the traceback site. | **Fixed** — probe now records `pythonHasPandas`; csv check fails fast with `'pandas is not installed for python3 or python; the csv check needs it (CI runs: pip install pandas)'` **only for code that imports pandas**; code without the import (`print(999)`, `raise`) still executes and is judged as before. Regression test added. Benchmark-internal module; not shipped in the npm package. |
| F-2 | P3 (residual, accepted) | `scripts/publish-openclaw-skills.js:64` runs `spawnSync(cmdline, { shell: true })` with a hand-rolled `quote()` that is not a full POSIX escaper (double quotes don't escape `$`/backtick). Args are repo-controlled slugs/versions plus maintainer-typed passthrough; maintainer-only script, not shipped. | Documented residual; no change (a full escaper for a maintainer tool with self-typed args is unneeded machinery). |
| F-3 | P3 (observation) | Local `npm test` stops before the pi-extension suite when the root suite fails (`&&` chain). By design in CI (both green there); running the prefix suite separately is documented in TEST_RESULTS.md. | No change. |

## 5. Dead code / removal review

Candidates examined, all **live** — no removals made (per Phase 7 evidence rules):

- `hooks/band/*` — referenced by `hooks/claude-band.json` (`modules`) and `.claude-plugin/plugin.json` (`types`).
- `__init__.py` — the Hermes plugin adapter entrypoint.
- All 6 skills — referenced by the pi extension, OpenCode commands, and Hermes `register()`.
- Rule copies across adapters — `check-rule-copies.js` proves sync with AGENTS.md.
- 15 `shortcut:` comments are the repo's own intentional, tracked debt ledger (see `skills/ponytail-debt`), not dead code.

## 6. Changelog for this audit

- `benchmarks/correctness.js` + `tests/correctness.test.js`: csv-check dependency diagnosability fix with regression test (F-1). 2 files, +37/−3.

## 7. Skipped / not executed

- REA toolkit: **not installed** in this environment (verified: no skill, no MCP registration). Static inspection + the repo's own tests were used instead; no REA-specific infrastructure was added.
- Ponytail skill commands (ponytail-review/audit/debt): the repo's own `check-*` scripts and test suite are the executable equivalents here and were used; no coding-agent session was available to invoke the skills in.
- pandas installation into the user's Python: deliberately not performed (system change beyond silent authorization). The one failing test is environmental and passes in CI.
- Any push/publish: not performed (requires explicit authorization).
