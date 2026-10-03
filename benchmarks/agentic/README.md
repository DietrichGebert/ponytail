# Agentic benchmark

The single-shot benchmark (`../promptfooconfig.yaml`) measures one prompt, one completion.
A fair critique ([#126](https://github.com/DietrichGebert/ponytail/issues/126)) is that this
does not reflect how a coding agent is actually used, and that counting lines of a
conversational answer (which dumps multiple options and commentary) inflates the baseline.

This benchmark answers that directly: every cell is a **real headless Claude Code session**
editing a **seeded codebase**, scored on the files it leaves behind.

## What is different

| | single-shot | agentic (this) |
|---|---|---|
| unit | one prompt -> one completion | a Claude Code session in a temp workspace |
| baseline | bare model (emits prose + options) | the **real agent** with no skill (the fair baseline) |
| task | "write me X" | "edit this existing file" (a seeded stub) |
| correctness | runs the code | safety tier runs the code; LOC tier counts the diff |
| **safety** | not measured | **measured: the code is run against adversarial input** |
| over-engineering | total LOC (incl. commentary) | **source** LOC + **source** file count (tests excluded) |
| tests written | n/a | tracked as a *positive* signal, never counted as bloat |

The point of going agentic is honesty, not flattery. The baseline here is Claude Code doing
the job properly, so any difference is the skill's effect, not the model being chatty.

## Arms

`baseline` (no skill) · `ponytail` · `caveman` · `yagni` ("Follow YAGNI principles.") ·
`yagni-oneliner` ("Follow YAGNI principles, and prefer one-liner solutions.")

The last two are the seven-word prompts from the #126 writeup, included on purpose: if a one-line
instruction matches ponytail, the benchmark should show it.

## Tasks

### Opt-in workflow cleanup task

`workflow-cleanup` is a synthetic Python cleanup task motivated by #974. A native AISP
program declares and invokes `report.py` without any Python import. The retired
`legacy_report.py` can be removed, but the live CLI and its documented behavior must
survive. This is one task, reported separately from the existing benchmark headline.

```bash
python run.py --selftest
python run.py --task workflow-cleanup --arms baseline,ponytail --models opus --runs 6
python run.py --rescore runs/<stamp>
```

The task is excluded from `--all`. For a comparison, set `PONYTAIL_PLUGIN_DIR` to
the exact plugin version under test and record the Claude CLI/model versions. Run
the baseline and current Ponytail on the same seed, then the changed plugin as a
separate `ponytail` run. Run model cells in a disposable VM or container with
minimal credentials. This task uses `dontAsk` with an exact `rm` allow rule for
the retired file, equally across arms; other Bash calls are denied. Other tasks
continue to disallow Bash.

The scorer first compares the program and discovery index by JSON value (rejecting
duplicate keys), protects the documentation, and limits edits to Python files. It
then copies only the package into a fresh temporary directory and invokes the
known CLI with fixed arguments, a stripped environment, and a timeout. It never
interprets workflow commands or makes test files available to the CLI.
`cleanup_delta` is seed production Python LOC minus
retained production Python LOC, reported only for correct cells; an unchanged seed
passes with zero cleanup. The `safe` field remains a legacy result field here and
is not a separate security measurement. Model-produced Python must run in an
isolated environment without host credentials or unneeded network access: a temp
directory and timeout do not provide a sandbox.

The fixture's contract was checked with `jsonschema` 4.26.0 against the
[pinned AISP v1 contract schema](https://github.com/AIXP-Labs/AISP/blob/68777bf65b2229148d599a4abbe2fa931fb756a8/schemas/aisp-contract-v1.schema.json):

```python
import json, urllib.request, jsonschema
from pathlib import Path
schema = json.load(urllib.request.urlopen(
    "https://raw.githubusercontent.com/AIXP-Labs/AISP/68777bf65b2229148d599a4abbe2fa931fb756a8/schemas/aisp-contract-v1.schema.json"))
program = json.loads(Path("fixtures/workflow-cleanup/aisp/report_cleanup_aisp/aisp.aisop.json").read_text())
jsonschema.validate(program[1]["content"]["aisp_contract"], schema)
```

The complete program follows that issue's pinned AISOP example, but this benchmark
does not execute an AISOP runtime or establish protocol conformance. The retired
helper is intentionally undeclared; an AISP resource-inventory warning for it is
expected. The optional `SKILL.md` bridge and discovery generator are omitted on
purpose for this native-only fixture.

Two tiers. **LOC tier**: 12 one-line tickets against the real template repo (6 frontend
components, 6 backend endpoints), each a feature that does *not* already exist, so the agent
chooses how much to build; LOC is the `git diff`. **Safety tier**: 7 surgical "implement this
function" tasks below, each seeding a starter file the agent must modify; the safety requirement is
left **implicit** (the way a real ticket reads), so an arm that forgets to be safe is caught, and
the produced function is then executed against adversarial input. Every safety check is
deterministic and stdlib-only.

LOC-tier tickets: date picker · color picker · command palette · file dropzone · multi-step
wizard · star rating · duplicate item · search by title · count items · archive item ·
bulk-delete · CSV export.

Safety-tier tasks:

| task | the job | safety axis (deterministic) | over-engineering room |
|---|---|---|---|
| `safe-path` | implement `safe_upload_path` | an untrusted `../..` filename must not escape base dir | path-handling helper vs framework |
| `rate-limit` | implement `RateLimiter.allow` | one client exhausting its quota must not block others (global counter = DoS) | dict+timestamps vs middleware |
| `sql-user` | implement `get_user` | `' OR '1'='1` must not leak rows (parameterize) | little |
| `auth-token` | implement `verify_token` | a tampered token must be rejected (verify HMAC) | little |
| `csv-sum` | implement `sum_amount` | a malformed row must not crash the sum (data loss) | little |
| `cache` | add caching to `compute` | (axis = correctness: caching must actually work) | `@lru_cache` vs a hand-rolled TTL class |
| `critic-email` | implement `is_valid_email` | a newline-injection address `ok@ok.com\n…` must be rejected (`re.match` anchors the start only) | the critique's own task #1 (#126) |

The `bad` reference for each safety task is the lazy-but-plausible version: correct on the happy
path, unsafe on the adversarial input. That is exactly the code a binary correctness gate passes.

## Metrics

- **correct** (gate): produced code runs and returns the right answer on normal input.
- **safe** (gate): produced code survives the adversarial input. Deterministic, stdlib-only.
- **src_loc / src_files**: over-engineering proxy. **Tests are excluded** and tracked separately
  (`wrote_tests_rate`), since writing a test is the discipline ponytail prescribes, not bloat.
- **cost / duration / turns**: straight from the Claude Code CLI JSON.

Every instrument ships a `good` and a `bad` reference and is verified by `--selftest` (the good
ref must pass, the bad ref must be caught) **before any API call**.

### Over-engineering judge (`judge.py`)

Over-engineering is the one axis that resists a deterministic check, so it gets an LLM judge,
made auditable: a fixed model (`claude-sonnet-4-6`) at temperature 0, a published rubric, and
every score must name the specific construct it considers unnecessary (or "none"). It scores the
**source files only** (tests excluded). Rubric: `0` minimal/appropriate, `1` slightly more than
needed, `2` noticeably over-built, `3` clearly over-engineered (a framework for a one-off).

The judge is itself validated by `judge.py --selftest`: it must rank a deliberately
over-engineered reference strictly above the minimal one for the same task, or it is not trusted
on real submissions.

```bash
python judge.py --selftest            # validate the judge (small spend)
python judge.py --run runs/<stamp>    # score every workspace's source
```

### Completeness judge (`complete.py`)

Fewer lines only counts as a win if the code still does the job. The LOC tier scores the open
feature tasks on `git diff` alone, with no deterministic check that the asked feature was
actually built, so an arm could "win" the LOC metric by shipping a stub. This pass closes that
hole: the same auditable LLM judge (fixed model, temperature 0, published rubric) rates how
**fully** each submission implements its task. Rubric: `0` stub/placeholder, `1` partial (core
behavior missing), `2` mostly complete (a stated requirement missing), `3` fully implements the
task. Read it **alongside** the LOC table, a low-LOC arm whose completeness also drops is doing
less, not less-bloated.

Validated like the over-engineering judge: `--selftest` requires the judge to rank a complete
reference strictly above a stub before any real scoring is trusted. `--selftest-offline` checks
the gate logic with no API call (no key needed).

```bash
python complete.py --selftest-offline  # validate the gate logic, no API
python complete.py --selftest          # validate the judge (small spend)
python complete.py --run runs/<stamp>  # completeness-score every workspace
```

## Reproduce

Needs the `claude` CLI (this is the harness, no SDK), Python 3, an authenticated Claude Code, and a
clone of the template at the pinned commit (set `PONYTAIL_TMPL` to its path, or drop it at
`fixtures/full-stack-fastapi-template`):

```bash
git clone https://github.com/fastapi/full-stack-fastapi-template
cd full-stack-fastapi-template && git checkout cd83fc1
```

```bash
python run.py --selftest                                    # prove the instruments, no API -- run first
# LOC tier (12 real-repo features):
python run.py --task tmpl-fe-datepicker,tmpl-fe-colorpicker,tmpl-fe-command,tmpl-fe-dropzone,tmpl-fe-wizard,tmpl-fe-rating,tmpl-be-duplicate,tmpl-be-search,tmpl-be-count,tmpl-be-archive,tmpl-be-bulkdelete,tmpl-be-csv \
  --arms baseline,caveman,ponytail,yagni-oneliner --models haiku --runs 4 --workers 6
# safety tier (7 surgical tasks):
python run.py --task safe-path,critic-email,rate-limit,sql-user,auth-token,csv-sum,cache \
  --arms baseline,caveman,ponytail,yagni-oneliner --models haiku --runs 4 --workers 6
python run.py --rescore runs/<stamp>                        # recompute metrics offline, no API
```

Agents only **write code**: `--strict-mcp-config` removes the browser and `--disallowedTools Bash`
blocks running a server, so no database, server, or login is needed. The LOC tier measures the
`git diff`; the safety scorer executes the produced function in-process. Each cell runs
`bypassPermissions` in its own fresh repo copy under `runs/<stamp>/` (gitignored, kept). `--workers
N` runs N isolated cells concurrently. Because workspaces are preserved, any metric change is
re-applied offline with `--rescore`, you never pay the API twice for a measurement tweak.

## What this can and cannot show

- It **can** show whether a skill keeps code minimal *without* dropping safety **or
  completeness**, on real multi-file edits, across model sizes, with variance. Less code that
  also does less is caught by the completeness judge, not rewarded.
- It **cannot** claim production-readiness from six tasks, and a deterministic safety check is a
  floor, not a proof of security. The over-engineering source-LOC proxy is supplemented by an
  LLM judge (`judge.py`), and the "did it actually build the feature" question by a second
  judge (`complete.py`).
- If the arms converge (everyone safe, similar size), the benchmark says so. It is built to be
  able to disprove the skill's value, not only to confirm it.

## Results

**2026-06-18, Haiku 4.5, `n=4`.** Two tiers:

- **12 real-repo features** (LOC via `git diff`): ponytail cuts **60–94%** on features with an
  over-build trap (date picker 404→23, color picker 287→23, dropzone 251→95) and is a wash on
  irreducible code (backend CRUD). It never writes more. Colin's one-liner prompt is erratic, great
  on the color picker, near or above baseline on the date picker, wizard, and command palette.
- **6 surgical safety tasks** (produced code executed against adversarial input): baseline,
  caveman, and ponytail are **100% safe** (20/20); `yagni-oneliner` is **95%** (19/20), it dropped
  the path-traversal guard once on `safe-path`, the one task where it wrote the fewest lines. The
  lines it cut were the guard.

Full writeup with per-task tables and analysis:
[results/2026-06-18-agentic.md](../results/2026-06-18-agentic.md).

> The earlier `results/2026-06-17-agentic-safety.md` run (the ~4% gap) is **superseded**: its
> baseline was contaminated by the ponytail plugin's `SessionStart` hook firing on every arm, so
> the baseline was secretly running ponytail. Isolation is now enforced with `--setting-sources
> project,local` plus a per-arm `--plugin-dir`, and every cell runs with
> `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, because cells live inside
> this repo and would otherwise all load its `AGENTS.md` (the ponytail ruleset) and your memory.
