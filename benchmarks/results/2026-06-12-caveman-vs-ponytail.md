# Caveman vs Ponytail — 2026-06-12

5 coding tasks × fresh subagent per config, same model. Tokens = agent total
(includes thinking). Code lines = fenced blocks in the deliverable, approx.
n=1 per cell — durations carry noise.

## Ponytail v1 (before this benchmark)

| Task | Baseline | Caveman | Ponytail v1 |
|---|---|---|---|
| email | 31,971 tok · 104s · ~34 loc | 26,464 · 20s · ~25 | 27,582 · 32s · 6 |
| debounce | 23,966 · 25s · ~38 | 26,496 · 19s · ~36 | 27,812 · 33s · 6 |
| csv-sum | 22,607 · 11s · 6 | 26,062 · 13s · 6 | 26,867 · 20s · 7 |
| react-countdown | 44,629 · 208s · ~190 | 26,656 · 21s · ~30 | 28,748 · 49s · 13 |
| rate-limit | 38,782 · 131s · ~25 | 32,732 · 63s · ~20 | 32,579 · 93s · ~21 |
| **Total** | **161,955 · 479s · ~293** | **138,410 · 136s · ~117** | **143,588 · 228s · ~53** |

### v1 findings

1. Code minimalism: ponytail dominated (2.2× fewer lines than caveman, 5.5× fewer than baseline).
2. Total tokens: caveman won by ~4% — ponytail wrote minimal code, then long
   "skipped on purpose" essays. Prose ate the code savings.
3. Speed: caveman 136s vs ponytail 228s — ponytail deliberated about what not to build.
4. Floor effect: on already-minimal tasks (csv-sum) both skills pay ~3k tokens
   skill-read tax over baseline.

## Ponytail v2 (after fixes)

v2 changes: Output cap (code + ≤3 short lines, "if the explanation is longer
than the code, delete the explanation"), ladder-is-a-reflex clause
(anti-deliberation), ship-and-question rule (never stall on "do you need X?").

| Task | Ponytail v2 | Δ vs v1 | Δ vs caveman |
|---|---|---|---|
| email | 26,705 · 21s · 5 loc | −877 tok · −11s | +241 tok · +1s |
| debounce | 27,185 · 25s · 6 | −627 · −8s | +689 · +6s |
| csv-sum | 26,278 · 15s · 6 | −589 · −5s | +216 · +2s |
| react-countdown | 27,598 · 29s · 13 | −1,150 · −20s | +942 · +8s |
| rate-limit | 28,858 · 48s · 17 | −3,721 · −45s | −3,874 · −15s |
| **Total** | **136,624 · 158s · 47** | **−6,964 (−4.8%) · −70s (−31%)** | **−1,786 (−1.3%) · +22s** |

## Ponytail v3 (skill file compressed)

v3 change: SKILL.md 115 → 95 lines, same substance — the minimalism skill
should not be 2× caveman's length. Cuts read cost per invocation and
injection cost per session.

| Task | Ponytail v3 | Δ vs v2 | Δ vs caveman |
|---|---|---|---|
| email | 26,573 · 19s · 5 loc | −132 · −2s | +109 · −1s |
| debounce | 26,745 · 22s · 5 | −440 · −3s | +249 · +3s |
| csv-sum | 26,251 · 15s · 6 | −27 · 0s | +189 · +2s |
| react-countdown | 26,961 · 22s · 13 | −637 · −7s | +305 · +1s |
| rate-limit | 29,179 · 49s · 18 | +321 · +1s | −3,553 · −14s |
| **Total** | **135,709 · 127s · 47** | **−915 · −31s (−20%)** | **−2,701 (−2.0%) · −9s (−7%)** |

## Verdict (v3)

| Area | Winner |
|---|---|
| Code size | **Ponytail** — 47 vs 117 lines (2.5×) |
| Deliverable prose | **Ponytail** — capped at 3 skip-lines, under caveman's gotcha lists |
| Total tokens (cost) | **Ponytail** — 135.7k vs 138.4k (−2.0%) |
| Wall time | **Ponytail** — 127s vs 136s (−7%; n=1, treat as parity-or-better) |
| Follow-up prevention | **Ponytail** — every skip names its escalation trigger |

Both skills demolish the no-skill baseline: −16% tokens, ~3× faster, and the
baseline's degenerate cases (190-line countdown dashboard, 208s) simply don't
happen. Remaining ~3.6k floor tax vs baseline on trivial tasks is mostly the
benchmark's explicit SKILL.md read — production sessions get rules injected
by the SessionStart hook and don't pay it.
