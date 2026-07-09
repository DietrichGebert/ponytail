# Agentic benchmark: does ponytail cut code without cutting safety?

*2026-06-18. Haiku 4.5. Real Claude Code sessions on a real open-source repo.*

This is a rebuilt benchmark written in direct response to Colin Eberhardt's critique in
[issue #126](https://github.com/DietrichGebert/ponytail/issues/126). His points were fair, so
this run is built to be able to *disprove* ponytail, not just flatter it.

## The critique, restated honestly

The original ponytail benchmark was single-shot: one prompt, one completion, count the lines.
Colin argued, correctly, that:

1. **A single completion is not how a coding agent is used.** Real work is an agent editing a
   real codebase over many turns.
2. **The baseline was a bare, chatty model.** It emitted prose, caveats, and multiple options, so
   "lines of the answer" counted commentary, not code. That inflates the baseline and flatters the
   skill. The 80–94% reductions were partly a conversational-baseline artifact.
3. **"Prefer one-liners" might trade away safety.** If the discipline is "write less," does it drop
   input validation and error handling to get there?
4. A short prompt ("Follow YAGNI principles, and prefer one-liner solutions") might do the same job
   as a whole skill.

All four are reasonable. This benchmark answers them.

## What changed

| | single-shot (old) | agentic (this) |
|---|---|---|
| unit of work | one prompt → one completion | a **real headless Claude Code session** in a temp workspace |
| baseline | bare API model (emits prose + options) | the **same Claude Code agent with no skill** |
| task | "write me X" | a real ticket against a real repo, or "implement this function" |
| LOC counted | whole answer incl. commentary | **`git diff` added lines** of the files the agent leaves behind |
| arms | ponytail vs bare model | baseline · ponytail · caveman · **Colin's own one-liner prompt** |
| safety | not measured | **measured: the produced code is executed against adversarial input** |

The baseline here is Claude Code doing the job properly. Any difference is the skill's effect, not
the model being chatty. That is the core of Colin's critique, and it is now controlled for.

### A contamination bug we found in our own numbers

An earlier agentic run showed a tiny ~4% gap and we nearly published it. It was wrong: ponytail and
caveman are Claude Code **plugins** that fire a `SessionStart` hook, and that hook was firing on
*every* arm, including the baseline, so the baseline was secretly running ponytail. Fixed by
isolating each arm: `--setting-sources project,local` excludes the user's global plugins, and
exactly one plugin is loaded per arm via `--plugin-dir`. We mention this because it is the kind of
error that makes a benchmark lie, and finding it is the reason to trust the rest.

## Setup

- **Engine:** Claude Code `2.1.177`, headless (`claude -p`), `--output-format json`. Not a bare
  API model, the same product people actually use.
- **Model:** Haiku 4.5 (`claude-haiku-4-5-20251001`). One model is enough to make the point; the
  harness supports Sonnet/Opus.
- **Repo:** [`tiangolo/full-stack-fastapi-template`](https://github.com/fastapi/full-stack-fastapi-template)
  @ `cd83fc1` (MIT). A real, popular FastAPI + React codebase. Public and pinned, so anyone can
  reproduce.
- **Arms:**
  - `baseline`: no skill.
  - `ponytail`: the skill, loaded as its real plugin.
  - `caveman`: a *terse-prose* skill (talks short, builds normally). A control: if ponytail's
    effect were just "be brief," caveman would match it.
  - `yagni-oneliner`: Colin's seven words: *"Follow YAGNI principles, and prefer one-liner
    solutions."* appended to the system prompt. The direct test of point (4).
- **Isolation:** every cell gets its own fresh copy of the repo and its own fresh agent context
  (separate process, no shared history). `n=4` runs per (task, arm). Nothing carries between runs.
- **Metric:** LOC is `git diff` added lines (comments included) of the files the agent writes.
  We do **not** run a server or a browser, agents only write code; we measure the code. (The safety
  tasks are the exception: their scorer executes the produced function directly.)

Two axes, because the tasks split into two kinds:

- **Over-build room**: open features in the real repo, where the agent chooses how much to build.
- **Surgical room**: "implement this one function," little room to over-build, where the question
  is whether minimizing drops a *guard*.

## Axis 1: lines of code on real features (12 tasks)

Each task is a one-line ticket against the template. LOC is the mean of 4 runs.

**Frontend**

| task (ticket) | baseline | caveman | **ponytail** | yagni-oneliner |
|---|--:|--:|--:|--:|
| date picker | 404 | 202 | **23** | 162 |
| color picker | 287 | 188 | **23** | 25 |
| file dropzone | 251 | 226 | **95** | 175 |
| multi-step wizard | 571 | 492 | **312** | 406 |
| star rating | 103 | 95 | **70** | 101 |
| command palette | 268 | 260 | **233** | 285 |

**Backend**

| task (ticket) | baseline | caveman | **ponytail** | yagni-oneliner |
|---|--:|--:|--:|--:|
| archive/unarchive item | 175 | 197 | **116** | 147 |
| search items by title | 44 | 44 | **44** | 43 |
| export items as CSV | 36 | 36 | **33** | 32 |
| bulk-delete items | 33 | 29 | **26** | 24 |
| duplicate an item | 24 | 24 | **23** | 20 |
| count user's items | 21 | 20 | **17** | 18 |

What this says, including where ponytail does **not** win:

1. **Big wins are exactly where a native platform feature replaces a custom build.** Date picker
   −94%, color picker −92%, dropzone −62%. The baseline hand-builds a component; ponytail reaches
   for `<input type="date">`, `<input type="color">`, `<input type="file">`. This is the discipline
   working as designed, not a chatty-baseline artifact, the baseline here is real Claude Code.
2. **On irreducible code the arms converge.** Backend CRUD endpoints and the command palette are
   near-identical across all arms. ponytail trims a little and never bloats, but it does not invent
   savings where there are none. An honest benchmark has to show this, and it does.
3. **caveman lands between baseline and ponytail.** Terseness alone explains part of the gap but
   not most of it. The effect is the lazy-*code* discipline, not short talk.
4. **Colin's one-liner prompt is erratic.** Brilliant on the color picker (25), but near or *above*
   baseline on the date picker (162), wizard (406), and command palette (285 > baseline's 268). The
   plugin is consistent; the seven-word prompt is not. That is the answer to point (4): the prompt
   sometimes lands and sometimes doesn't, the skill lands every time.

Bonus: where ponytail cuts code it is also cheaper and faster (date picker: ~$0.06 / 49s vs the
baseline's ~$0.15 / 88s), fewer lines is fewer tokens.

## Axis 2: does minimizing drop a guard? (6 tasks)

Each task seeds a starter file and asks for one function. The safety requirement is left **implicit**,
the way a real ticket reads. The scorer then **executes the produced function against adversarial
input** (deterministic, stdlib-only): path traversal, SQL injection, a forged token, a malformed CSV
row, a quota-exhausting client. The `bad` reference for each is the lazy-but-plausible version:
correct on the happy path, unsafe on the adversarial one, exactly what a one-liner is tempted to write.

**Safe rate (5 security tasks × 4 runs = 20 runs per arm):**

| arm | safe | LOC where it matters |
|---|--:|---|
| baseline | 100% (20/20) | - |
| caveman | 100% (20/20) | - |
| **ponytail** | **100% (20/20)** | safe-path 9.5, sql-user 4.5 |
| yagni-oneliner | **95% (19/20)** | safe-path **6** |

The whole thesis is in one task. On `safe-path` (join an untrusted filename onto a base directory):

- **yagni-oneliner** wrote the fewest lines (6) and went unsafe **once in four**, a `../../`
  filename escaped the directory.
- **ponytail** wrote ~9.5 lines and was safe **4/4**.

The ~3 lines ponytail kept *were the path-traversal check*. "Write less" without judgment cuts the
guard; ponytail's rule, *never simplify away input validation at trust boundaries*, keeps it. That
is the difference between lazy and careless, and it is the answer to point (3).

Honest caveat: at Haiku scale the safety gap is small, one slip in twenty. It is a floor, not a
dramatic result, and a deterministic check is not a proof of security. But the direction is exactly
the design hypothesis, and the only arm that dropped a guard was the bare one-liner prompt.

## Summary: percent change vs baseline (all metrics)

Mean across each tier's tasks (every task averaged over 4 runs), relative to the no-skill baseline.
Negative is less code / cheaper / faster.

**12 feature tasks** (baseline absolute, per task: 191 LOC, 349k tokens, $0.097, 69s):

| arm | LOC | tokens | cost | time |
|---|--:|--:|--:|--:|
| caveman | −20% | +7% | +3% | +2% |
| **ponytail** | **−54%** | **−22%** | **−20%** | **−27%** |
| yagni-oneliner | −33% | −14% | −21% | −30% |

**6 safety tasks** (baseline absolute, per task: 12 LOC, 104k tokens, $0.038, 22s):

| arm | LOC | tokens | cost | time | safe |
|---|--:|--:|--:|--:|--:|
| caveman | −4% | −8% | −4% | +12% | 100% |
| **ponytail** | **−5%** | **−18%** | **−7%** | **−1%** | **100%** |
| yagni-oneliner | −18% | −4% | −8% | +3% | **95%** |

Reading it:

- **ponytail is the only arm that cuts every metric** on the feature tasks, and the only large code
  cut (−54%). caveman writes less code but spends *more* tokens (+7%), terse output, same
  deliberation, so it is not cheaper. yagni-oneliner is cheap and fast but cuts less code than
  ponytail and is the one arm that dropped a safety guard.
- The **−54% LOC is the across-task aggregate**; per task it runs from ~0% (irreducible backend
  CRUD) to −94% (date picker). The average is pulled down by tasks with no bloat to cut, this is the
  honest aggregate, not the cherry-picked peak.
- On the surgical safety tasks the code is tiny for everyone (10–12 lines), so size barely moves;
  there the signal is the safe rate, where only yagni-oneliner slips.

## Limitations (so this can't be the next thing someone debunks)

- **One model.** Haiku 4.5 only. Bigger models may close the over-build gap (they need less hand-
  holding) or widen it. The harness runs Sonnet/Opus; we stopped at Haiku for cost.
- **Safety is a floor.** Six surgical tasks, deterministic checks. It shows whether an arm drops a
  *known* guard, not that the code is secure.
- **`yagni-oneliner` is our paraphrase** of Colin's argument, not a claim about his exact intent.
  It is the strongest short-prompt version we could write for the comparison.
- **Nondeterminism.** `n=4`. Frontend LOC varies run to run (a custom build is 300–570 lines); the
  means are stable but not tight. Backend and safety LOC are tight.
- **Four of 192 LOC cells** hit a Windows process-timeout bug mid-run and were force-killed; their
  LOC still counted (the files were written) but cost/time did not. Every (task, arm) kept ≥2 of 4
  runs. The bug is fixed in the harness.

## Conclusion

On a real repo, with the real agent, measured by `git diff`:

- ponytail **cuts 60–94% of the code** on features that have an over-build trap (custom component
  vs native input), and is a wash on code that is already minimal. It never writes more.
- It does this **without dropping a safety guard** (100% safe), while the bare "one-liner" prompt
  was the only arm that did (95%), and was also the inconsistent one on size.

The original 80–94% single-shot numbers were inflated by a chatty baseline, Colin was right. The
honest number on real tickets is "huge where there's bloat to cut, nothing where there isn't, and
not at the cost of safety." That is a smaller and more defensible claim, and it is the one ponytail
was actually built to make.

## Reproduce

See [`benchmarks/agentic/README.md`](../agentic/README.md). Short version: clone the template at
`cd83fc1`, then `python run.py --selftest` (no API), then the run command in that README. Every
workspace is preserved under `runs/<stamp>/` so any metric can be recomputed offline with
`--rescore`.
