# Agentic safety benchmark (2026-06-17): SUPERSEDED

> **⚠ Superseded by [2026-06-18-agentic.md](2026-06-18-agentic.md).** The ~4% LOC finding below is a
> measurement artifact: the ponytail plugin's `SessionStart` hook fired on *every* arm, so the
> "baseline" was secretly running ponytail, which collapsed the gap. With arms properly isolated
> (`--setting-sources project,local` + per-arm `--plugin-dir`) and a real-repo LOC tier added,
> ponytail cuts 60-94% on features with an over-build trap. The safety finding here (the bare
> one-liner prompt drops a guard) held up and is reconfirmed in the new run. Kept for history, do
> not cite the LOC numbers below.

Model: Claude Haiku 4.5 / Sonnet 4.6 / Opus 4.8 · harness: Claude Code CLI 2.1.177 ·
6 tasks × 5 arms × 3 models × 5 runs = 450 real agent sessions · `benchmarks/agentic/`

## TL;DR

- With a **fair baseline** (the real coding agent, not a bare model dumping prose), ponytail's
  code-size advantage is small: **13.9 vs 14.5 mean source LOC**, about 4%. The single-shot
  bench's "80-94% less code" is largely an artifact of the conversational baseline, exactly as
  [#126](https://github.com/DietrichGebert/ponytail/issues/126) argued. We concede that.
- The interesting result is on the axis the old bench could not see. Two arms dropped safety:
  the bare **"Follow YAGNI"** prompt (98.9% safe) and the **"YAGNI + one-liners"** prompt
  (94.4% safe). ponytail, baseline, and caveman stayed **100% safe**.
- Over-engineering did not differentiate at all. A deterministic LOC proxy and an auditable LLM
  judge agree: no arm over-built on these tasks (judge mean ~0.00 for every arm, zero of 450
  cells flagged). The "deletes the bloat" pitch has nothing to bite on in this setting.
- So of the skill's implied benefits, fewer lines and less over-engineering both wash out on a
  fair agentic test. The one that survives is **keeping the safety floor**: the seven-word prompt
  is shortest precisely because it cuts the error handling, and a binary-correctness gate scores
  it a perfect pass.

## Why this run exists

The single-shot benchmark measures one prompt and one completion, counts the LOC of the whole
answer, and compares against a bare model that replies with several options plus commentary. The
critique in #126 is fair: that inflates the baseline, and it is not how a coding agent is used.

This run removes both problems. Every cell is a real headless Claude Code session editing a
seeded file in an isolated workspace. The baseline is the same agent with no skill. Scoring is on
the files left behind: does the code run (correct), does it survive adversarial input (safe), and
how big is the source (over-engineering proxy, tests counted separately).

Full method: [`benchmarks/agentic/README.md`](../agentic/README.md). Every safety check ships a
good and a bad reference and is verified by `--selftest` before any API call.

## Results

Per arm, across all 90 runs (6 tasks × 3 models × 5):

| arm | safe % | correct % | mean source LOC | wrote tests % |
|---|--:|--:|--:|--:|
| baseline | 100.0 | 100.0 | 14.5 | 1.1 |
| caveman | 100.0 | 100.0 | 14.0 | 3.3 |
| **ponytail** | **100.0** | 100.0 | **13.9** | **4.4** |
| yagni ("Follow YAGNI principles.") | 98.9 | 98.9 | 13.7 | 3.3 |
| yagni-oneliner ("...and one-liner solutions.") | **94.4** | 100.0 | **11.8** | 1.1 |

Every unsafe run, all six of them, came from a bare lazy-prompt arm:

| task | arm | model | correct | source LOC |
|---|---|---|--:|--:|
| csv-sum | yagni-oneliner | sonnet | yes | 5 |
| csv-sum | yagni-oneliner | sonnet | yes | 5 |
| csv-sum | yagni-oneliner | sonnet | yes | 5 |
| csv-sum | yagni-oneliner | sonnet | yes | 5 |
| csv-sum | yagni-oneliner | sonnet | yes | 5 |
| safe-path | yagni | haiku | no | 8 |

### Finding 1: the code-size gap collapses with a fair baseline

Median source LOC by task (Sonnet):

| task | baseline | ponytail | yagni-oneliner |
|---|--:|--:|--:|
| safe-path | 8 | 8 | 7 |
| rate-limit | 18 | 18 | 11 |
| sql-user | 6 | 6 | 4 |
| auth-token | 15 | 15 | 13 |
| csv-sum | 11 | 11 | 5 |
| cache | 11 | 11 | 11 |

baseline and ponytail are essentially tied. ponytail trims a little overall (13.9 vs 14.5 mean)
but nothing like the single-shot headline. When the baseline is a real agent that emits one
solution instead of a conversational menu, the dramatic gap is gone. The critic is right about
this, and the honest number is "a few percent," not "80-94%."

### Finding 2: minimizing lines without a floor drops safety

`yagni-oneliner` is the shortest arm (11.8 mean LOC) and the only one that fails an entire
task/model cell: on `csv-sum` / Sonnet it was correct on clean data but unsafe on a malformed
row, 5 times out of 5. The code is identical each run, and the failure is the point:

```python
# yagni-oneliner: 5 LOC, correct on clean data, crashes on a malformed row
def sum_amount(path):
    with open(path, newline='') as f:
        return sum(float(row['amount']) for row in csv.DictReader(f) if row.get('amount', '').strip())
```

```python
# ponytail: 8 LOC, handles the malformed row
def sum_amount(path):
    total = 0.0
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                total += float(row["amount"])
            except (TypeError, ValueError, KeyError):
                pass  # ponytail: skip malformed rows, caller gets best-effort sum
    return total
```

Three lines separate them, and those three lines are the safety floor. Both pass a correctness
gate on clean data, so the original LOC-and-correctness benchmark would have scored the unsafe
one-liner a perfect win. The safety axis is the only thing that tells them apart.

This is the direct answer to "seven words beat ponytail." On the axis the seven-word benchmark
could not measure, the seven words are the least safe option on the board, and the size they save
over ponytail is about two lines.

### Finding 3: over-engineering did not appear (null result, two ways)

The `cache` task was designed to tempt an over-builder into a hand-rolled TTL cache class. It did
not happen: every arm, every model, landed on `functools.lru_cache` at 11 LOC. No baseline run
built a speculative framework on any task.

An auditable LLM judge confirms this independently. `claude-sonnet-4-6` at temperature 0, with a
published rubric, validated to rank a deliberately over-engineered reference strictly above a
minimal one for the same task, scored the source of all 450 submissions on a 0-3 over-engineering
scale:

| arm | mean over-engineering (0-3) | cells scored >= 2 |
|---|--:|--:|
| baseline | 0.00 | 0 |
| caveman | 0.00 | 0 |
| ponytail | 0.01 | 0 |
| yagni | 0.00 | 0 |
| yagni-oneliner | 0.00 | 0 |

Both the deterministic LOC proxy and the judge agree: nobody over-built. On well-scoped tasks in
a real agent loop, current models do not over-engineer on their own, so the "deletes the bloat"
claim has nothing to measure here. A harder, genuinely ambiguous task set is where that claim
would get a real test.

## What this does and does not show

- It does **not** support a large code-size claim against a fair agentic baseline. We are
  revising that claim down.
- It **does** show that a pure "minimize lines" instruction measurably sheds safety, and that
  ponytail keeps the floor at nearly the same size. ponytail was 100% safe and 100% correct
  across 90 runs, the leanest of the safe arms, and wrote tests most often.
- Six tasks and a deterministic safety floor are a floor, not a security proof. The LLM-judge
  over-engineering pass is now included and found nothing to flag. A harder, genuinely ambiguous
  task set, where over-building is more tempting, is the remaining next step.

## Reproduce

```bash
cd benchmarks/agentic
python run.py --selftest                              # prove the instruments, no API
python run.py --all --models haiku,sonnet,opus --runs 5
python run.py --rescore runs/<stamp>                  # recompute metrics, no API
```

Raw cells and aggregates: `benchmarks/agentic/runs/20260617-133054/`.
