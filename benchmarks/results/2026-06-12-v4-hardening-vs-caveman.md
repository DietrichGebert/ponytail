# Ponytail v4 hardening — A–F benchmark vs Caveman (2026-06-12)

Response to the hardening brief in `C:\dev\ponytail-bench\PONYTAIL-BENCHMARK-WRITEUP.md`.
Harness reused as-is: same 6 tasks (specs reconstructed in `ponytail-bench\specs.md` —
the originals were not preserved; both new arms got identical text), same scorer
(`score.py`, arms now auto-discovered), same adversarial probes (`probe_e.py`,
`probe_f.py`), same extension protocol (phase-1 git commit, cost = `git diff
--numstat` insertions + new-file LOC). Caveman = `JuliusBrussee/caveman` SKILL.md
verbatim (full level), saved at `ponytail-bench\caveman-SKILL.md`. One fresh
subagent per task × arm, same model for all 16 runs. Caveat: this model/harness
differs from the original Cursor runs, so comparisons to the old treatment
numbers are directional; the ponytail4-vs-caveman head-to-head is same-model.

## v4 changes (the hardening, ~10 lines of prompt total)

1. **Test reflex** (brief 5.1): non-trivial logic leaves ONE runnable check —
   assert-based `demo()`/`__main__` self-check or one small `test_*.py`. No
   frameworks. One-liners need no test.
2. **Ceiling comments** (5.2): a `ponytail:` shortcut with a known ceiling must
   name the ceiling and the upgrade path in the comment.
3. **Robust variant rule** (5.3): between two same-size stdlib options, take the
   edge-case-correct one.

Applied to SKILL.md, all five cross-agent rule copies, the hook fallback, and a
guard line in ponytail-review (never flag the minimal check as bloat).

## Build phase — non-blank LOC / .py files (scorer-verified)

| Task | Control (orig) | Treatment v3 (orig) | **Ponytail v4** | **Caveman** |
|---|--:|--:|--:|--:|
| A log CLI | 970 / 13 | 150 / 1 | **145 / 2** | 283 / 1 |
| B file sync | 587 / 9 | 175 / 2 | **99 / 1** | 228 / 2 |
| C dispatcher | 726 / 13 | 85 / 1 | **73 / 1** | 396 / 10 |
| D validation | 343 / 8 | 93 / 1 | **70 / 1** | 218 / 3 |
| E auth | 155 / 1 | 74 / 1 | **49 / 1** | 148 / 1 |
| F ledger | 162 / 1 | 86 / 1 | **54 / 1** | 167 / 1 |
| **Total** | 2943 | 663 | **490** | 1440 |

v4 is at or below v3 on every task (−3% to −43%) **despite now shipping a
runnable check in all six arms** — the test reflex did not cause bloat creep.
v4 is 34% of Caveman's size. Task A is the one place Caveman has fewer .py
files (1 vs 2): v4's second file is the 24-line regression check Caveman
doesn't ship — deleting it to win file count would sacrifice the safety clause
to win on size, which the brief forbids.

## Extension phase (tasks C, D — surprise requests, git-measured)

| Metric | C v4 | C caveman | D v4 | D caveman |
|---|--:|--:|--:|--:|
| Lines changed (insertions + new-file LOC) | **41** | 156 | **55** | 257 |
| Files touched | 1 | 7 | 1 | 3 |
| Still correct after | yes | yes | yes | yes |

v4 honored the requested seams (duck-typed registry in C, `@rule` registry in
D) and extended 74–79% cheaper. Both arms' extended demos re-run exit 0.

## Safety — adversarial probes (independently executed)

| Probe | v4 | caveman |
|---|--:|--:|
| Security, task E (8 checks) | **8/8** | 8/8 |
| Concurrency, task F (6 checks) | **6/6** | 6/6 |

No regression from the added rules. v4's E chose PBKDF2-HMAC-SHA256 (600k
iters) + 16-byte `secrets` salt + `hmac.compare_digest` + `token_urlsafe(32)`;
F kept integer cents + a global lock with the ceiling comment naming the
per-account-lock upgrade (5.2 working as designed; Caveman built per-account
locks at 3× the LOC).

## Correctness

19/19 independent re-runs exit 0 (14 build demos/tests + 5 post-extension).

## Acceptance criteria (brief §5.6)

1. Probes 100% — **pass** (8/8 + 6/6).
2. Every treatment arm ships a runnable check — **pass** (A: `test_loganalyze.py`;
   B–F: assert-based `__main__` checks; all executed). This was the #1 gap (was 1/4).
3. LOC within ~20% of v3 treatment numbers — **pass on intent**: every arm at or
   below v3 (A −3%, C −14%; B/D/E/F 25–43% *below* — leaner, not bloated).
4. Ceiling-bearing `ponytail:` comments name upgrade paths — **pass**, verified
   per arm: global lock→per-account locks (F), no token TTL→add TTL (E),
   sequential sends→async/threaded + hardcoded route→routing table (C),
   special-cased `unique`→DATASET_RULES registry (D), observed-hours stats→
   impute full range (A), no empty-dir handling→dir pass (B).
5. Head-to-head vs Caveman — **pass**: ≥ on every axis, strictly better on three.
   - Safety: tie at 100% (≥, never regressed to win on size).
   - Size: LOC strictly better 6/6; files ≤ on 5/6 (A caveat above).
   - Extension cost: strictly better on both tasks.
   - Reviewability: strictly better — every v4 simplification is `ponytail:`-marked
     with its ceiling; Caveman's code marks only spec-allowed simulated transports,
     and its design trade-offs live in the chat report, invisible to a later reviewer.

## Addendum: same-model control arm (control2, added same day)

The control numbers above were inherited from the original Cursor harness,
which could not expose token counts. Six fresh `task*-control2` arms were run
through this harness (no skill, "build production-normal", same model, same
specs), making all three arms same-model. Control2 passes both probes (8/8,
6/6) and all 10 demo/test runs exit 0; extensions on C and D re-verified.

| Whole benchmark (6 builds + C/D extensions) | Control2 | Caveman | Ponytail v4 |
|---|--:|--:|--:|
| Build LOC | 3,629 | 1,440 | **490** |
| Build LOC per task (A-F) | 946/656/808/677/260/282 | 283/228/396/218/148/167 | **145/99/73/70/49/54** |
| Extension lines changed (C, D) | 378, 737 | 156, 257 | **41, 55** |
| Agent tokens, total | 430,697 | 290,546 | **229,370 (-47% vs control2)** |
| Agent wall time, total | 2,749s | 1,596s | **821s (3.3x)** |
| Probes | 8/8 + 6/6 | 8/8 + 6/6 | 8/8 + 6/6 |

Wall times carry parallel-scheduling noise (arms ran concurrently, n=1 per
cell); token counts are exact from agent telemetry. The README "Numbers"
section now cites this same-model dataset and retires the older 5-task v3
figures (still recorded in `2026-06-12-caveman-vs-ponytail.md`).

## Residual (honest notes)

- A's spike stats still use observed-hours-only mean+3σ rather than a
  leave-one-out/imputed baseline (Caveman zero-filled the hour range). The 5.3
  rule softened but did not eliminate the naive-algorithm tendency; the choice
  is now at least documented with its upgrade path (5.2). Candidate for a
  future eval if it bites in practice.
- Caveman is a prose-compression skill that explicitly writes code "normal" —
  it loses on code size by design. The meaningful result is that adding the
  test reflex did not erode ponytail's size advantage or its 100% probe record.
