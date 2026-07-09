# Robustness audit: does ponytail degrade weak models? (2026-06-16)

Follow-up to [issue #65](https://github.com/DietrichGebert/ponytail/issues/65). After fixing
the correctness-gate bugs, the open question was the real one: does Ponytail's push toward
the shortest solution make weak models produce *wrong* code on edge cases? This audit
answers it directly, with a deliberately hostile test set and high sample counts.

## TL;DR

- Across **12 classic edge-case traps** (off-by-one, n=0, leap-century, subtractive Roman,
  deep nesting, …) on **two weak models** (`gpt-4.1-mini`, `gpt-5.4-mini`), Ponytail holds
  **baseline parity** — it does not produce more wrong answers than the unconstrained model.
- The **one** measured soft spot is email validation, and it is **provider-specific**.
  OpenAI models, at every size, sometimes reach for `email.utils.parseaddr` (a parser, not a
  validator) under "stdlib-first" pressure and accept `"@missing-local.com"`. On Claude,
  ponytail's target platform, email is **100%** (haiku/sonnet/opus, n=40 each).
- The slip is **not fixable by skill text**: 8 distinct SKILL.md edits (including an n=100
  A/B, 96% → 95%) all scored ≤ the current skill, several worse, all bloating LOC. Counter-
  instructions make small models overthink and fail *more*. Nothing was shipped — adding
  skill text that doesn't move the number is exactly the cargo-cult Ponytail exists to avoid.

## Method

`baseline` (no skill) vs `ponytail` (full SKILL.md), single-shot, default params,
`gpt-4.1-mini` and `gpt-5.4-mini`. Each task runs generated code against edge-case
assertions. Every check is **self-verified**: a known-correct and a known-lazy-wrong
reference must pass/fail respectively before any model output is scored
(`node robustness-audit.js --selftest`, 16/16). Runs were serial to avoid quota 429s
shrinking denominators.

## Edge-case traps (n=20/cell)

All 12 algorithmic tasks: `baseline 20/20 == ponytail 20/20` on **both** models. Examples
of the traps (the lazy version passes the common case, fails the edge):

| task | the trap a lazy impl misses |
|---|---|
| is_prime | n = 0, 1, negatives |
| factorial / fibonacci | n = 0 |
| binary_search | empty list, target at the last index (off-by-one) |
| is_leap_year / days_in_month | 1900 not leap, 2000 leap (century rule) |
| int_to_roman | subtractive forms (4=IV, 9=IX, 40=XL) |
| flatten | nesting deeper than one level |
| clamp | value already in range |
| chunk | trailing remainder |

The only sub-20 cell in the first run was `gpt-5.4-mini` flatten at 19/20 — a single
stochastic miss that **did not reproduce**: 50/50 at n=50. (`clamp` showed 19/19, i.e. one
API error, not a wrong answer.)

## Validators: the email slip is provider-specific

The one place ponytail measurably affects correctness is **email validation**, via the
parse ≠ validate trap: under "stdlib-first" pressure a model reaches for
`email.utils.parseaddr` — a *parser* that accepts malformed input like `@missing-local.com`
— instead of writing an explicit check. The split is by **provider**, not model size.

**OpenAI (email, baseline vs ponytail, n=50–100):**

| model | baseline | ponytail |
|---|--:|--:|
| gpt-4.1-mini | 100% | 98% |
| gpt-4.1 | 100% | 79% |
| gpt-5.4-mini | ~100% | ~92% |
| gpt-5.4 | 100% | 98% |
| gpt-5.5 | 98% | 94% |

**Claude (email, baseline vs ponytail, n=40):**

| model | baseline | ponytail |
|---|--:|--:|
| claude-haiku-4-5 | 35/40 | **40/40** |
| claude-sonnet-4-6 | 0/40 * | **40/40** |
| claude-opus-4-8 | 39/40 | **40/40** |

Every OpenAI model slips regardless of size (gpt-4.1 full is the worst). Every Claude model
is **100%** under ponytail.

\* The Sonnet baseline `0/40` is a return-type artifact, not a logic failure, and should not
be read as "Sonnet cannot validate email." Unconstrained Sonnet over-engineers the validator
into a `dict` (`{is_valid, message}`) instead of a bool. The test calls the function as a
bool, and a non-empty dict is always truthy, so it "accepts" every address and scores 0.
Read dict-aware (via `is_valid`), its logic is about 75% correct (9/12). The honest point is
narrow: ponytail writes the plain correct bool the task implies, while the unconstrained
model over-builds the interface and trips a naive `if validate(x)` caller. `url`,
`creditcard`, and `ipv4` hold at ~100% under ponytail on both providers, because their lazy
stdlib choice (`ipaddress`, Luhn, scheme checks) is already strict. Only email's obvious
stdlib tool is a parser.

## The fix that wasn't

SKILL.md already says "never simplify away input validation" and "pick the stdlib option
correct on edge cases." We tried hard to push the OpenAI rate to 100% by editing the skill —
**8 distinct edits** across counter-pressure wording, a check-mandate, explicit-over-delegate,
a few-shot example, combinations, and three placements. Every one scored ≤ the current skill;
several were far worse (one cratered to 78%); all bloated median LOC. The definitive n=100
A/B of the most promising edit:

```
OLD skill: 96/100 (96.0%)
NEW skill: 95/100 (95.0%)   -> within noise, no reliable effect
```

Counter-instructions backfire: piling validation rules onto the skill makes models overthink
and produce *more* broken validators, not fewer. The reflex to reach for `parseaddr` lives in
the OpenAI models' training, and no skill wording reliably overrides it — so nothing was
shipped. Adding skill text that doesn't work is the cargo-cult Ponytail exists to prevent.

## Conclusion

"Ponytail degrades model performance" is not supported. Across 12 edge-case traps, ponytail
holds baseline parity. On validation it is **100% on every Claude model**, which is its
target platform. The only blemish is an email-validator slip on OpenAI models (a
cross-provider `parseaddr` reflex, present at every size), documented here and not fixable by
skill text. The LOC win (about half the code) comes with no correctness tax on Claude.

## Reproduce

```bash
cd benchmarks
node robustness-audit.js --selftest        # verify all 16 instruments (no API)
node robustness-audit.js                    # 16-task audit, gpt-5.4-mini, n=20
AUDIT_MODEL=gpt-4.1-mini node robustness-audit.js

# email cross-provider (the slip)
ME_MODELS="gpt-4.1,gpt-5.4,gpt-5.5" ME_N=50 node model-email.js   # OpenAI  (OPENAI_API_KEY)
node claude-email.js                                              # Claude  (ANTHROPIC_API_KEY)
```
`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` read from `../.env`.
