# Agentic benchmark

The single-shot benchmark (`../promptfooconfig.yaml`) measures one prompt, one completion.
A fair critique ([#126](https://github.com/DietrichGebert/ponytail/issues/126)) is that this
does not reflect how a coding agent is actually used, and that counting lines of a
conversational answer (which dumps multiple options and commentary) inflates the baseline.

This benchmark answers that directly: every cell is a **real headless Claude Code session**
working in a **seeded codebase**, scored on its files or, for report tasks, its final response
and unchanged source bytes.

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

`ponytail2` loads a candidate plugin from `PONYTAIL2_PLUGIN_DIR`, next to the released `ponytail`. That is how
Ponytail 5 was measured against the previous Ponytail (v4.13) and no skill in one run.
For a current-main comparison, set `PONYTAIL_PLUGIN_DIR` to that checkout explicitly.

## Tasks

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

Since 2026-10 the suite has **39 tasks**: the 12 template tickets, 18 surgical tasks with hidden checks
(the safety tasks below plus bug fixes, refunds, a privacy case, and renames or format changes that must
reach every caller), and 9 open "build me" and "show me" requests where the agent picks the scope. The
full list is in `tasks.py`.

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

### Native debt tasks

| task | measured behavior |
|---|---|
| `native-debt` | Extend existing JSDoc, TSDoc, Javadoc and Python declaration documentation with a limit and revisit trigger. Preserve summaries, tags and implementation; do not duplicate an existing explanation or invent a tag. |
| `debt-report` | Load the selected arm's `skills/ponytail-debt/SKILL.md`; inspect continuation lines, a docstring, legacy notes and an unread linked ticket. |
| `debt-report-command` | Run the same report case using the `prompt` from that arm's `commands/ponytail-debt.toml`. |

The two report tasks use a report-only system instruction; existing coding tasks retain their
original code-writing instruction. `baseline` gets no plugin instructions. `ponytail` and
`ponytail2` each load the entry from their own resolved plugin directory, in addition to normal
plugin activation. A missing file fails the cell; it never falls back to the candidate's copy.
The condensed case tests the shipped command text, not the Gemini command dispatcher.

All arms receive the same JSON response format for deterministic scoring. Rows must preserve
source locations and copy the complete ceiling/trigger wording; the scorer checks the exact
admitted records, counts and unverified linked fields. It excludes illustrative prose, ordinary
strings, a keyboard-shortcut explanation and ignored generated output. The safety gate compares
every seed's bytes and rejects additional files or claimed tracker writes. Untouched report
seeds do not count as authored code. These are task-specific checks, not a general documentation
parser or proof that a host can execute tracker operations.

`--selftest` calibrates good reports against omitted records, false positives, a lost wrapped
trigger, unread metadata counted as missing, source edits, an unsolicited ledger file and
fabricated ticket success. Authoring references also exercise detached comments, duplicated
limits, invented tags, missing triggers and a changed implementation. Valid native documentation
passes with or without a `shortcut:` marker; the baseline is not required to adopt the plugin's
marker convention. Runner checks cover both
entry points, baseline isolation, different current/candidate instructions, unchanged coding
prompts, tool isolation and report metrics. These checks do not make API calls.

## Metrics

- **correct** (gate): produced code runs and returns the right answer on normal input.
- **safe** (gate): produced code survives the adversarial input. Deterministic, stdlib-only.
- For native debt, **correct** checks documentation placement/content or report rows; **safe**
  checks unchanged implementation or read-only reporting with no fabricated tracker writes.
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

It judges only the tasks scored on size alone (`vibe-*`, `open-*`, `tmpl-*`). On the repo tasks the
judge sees the agent's diff, not the whole seeded repo; an answer given only in chat is judged from
the chat; `ponytail:` markers are neutralized so the judge stays blind; runs killed at the timeout are
counted apart instead of scored 0. Without an API key it runs through the `claude` CLI login (no
temperature setting there; the self-test gates it the same way).

Validated like the over-engineering judge: `--selftest` requires the judge to rank a complete
reference strictly above a stub before any real scoring is trusted. `--selftest-offline` checks
the gate logic with no API call (no key needed).

```bash
python complete.py --selftest-offline  # validate the gate logic, no API
python complete.py --selftest          # validate the judge (small spend)
python complete.py --run runs/<stamp>  # completeness-score every workspace
python complete.py --run runs/<stamp> --model claude-opus-5-5 --arms baseline,ponytail2 --workers 6
```

## Reproduce

Needs the `claude` CLI (this is the harness, no SDK), Python 3.12, an authenticated Claude Code, and a
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
# Native debt comparison and existing convention/scaffolding regressions (no template needed):
PONYTAIL_PLUGIN_DIR=/abs/path/to/current-main PONYTAIL2_PLUGIN_DIR=/abs/path/to/candidate \
  python run.py --task native-debt,debt-report,debt-report-command,conv-service,cache \
  --arms baseline,ponytail,ponytail2 --models opus --runs 6
```

Coding tasks only **write code**; report tasks only inspect and answer. `--strict-mcp-config` removes MCP and `--disallowedTools Bash`
blocks running a server, so no database, server, or login is needed. The LOC tier measures the
`git diff`; the safety scorer executes the produced function in-process. Each cell runs
`bypassPermissions` in its own fresh repo copy under `runs/<stamp>/` (gitignored, kept). `--workers
N` runs N isolated cells concurrently. Because workspaces are preserved, any metric change is
re-applied offline with `--rescore`, you never pay the API twice for a measurement tweak.

For instruction acceptance, retain exact checkout revisions, model, per-run responses and
scores, cost and aggregates. Every candidate run must satisfy the applicable requirements;
report regressions or converging arms honestly. Offline calibration alone does not establish
behavioral improvement, and unavailable credentials or model quota leave the comparison pending.

## Debt tracker host exercise

The code-writing runner disables Bash and MCP; it cannot prove ticket mutations.
Run the debt instructions separately in an isolated host session with an explicitly
authorized sandbox tracker destination and the host's existing tools. Keep a
redacted transcript of the request, loaded revision, tool inputs/results, ticket
readbacks and final report. Scope reads to the selected or linked items.

Exercise report-only and declined offers (zero writes); explicit selected-item
creation (no repeated approval); linked-ticket reuse, unrelated content retention
and repeat invocation (no duplicates); and comments/tracker/both project guidance
(source linking requires its own authorization). Compare source files before and
after, and read back persisted source locations, ceilings, triggers and links.

Use controlled tool outcomes for absent/read-only access, permission denial,
partial success and timeout after an unknown result. Check that drafts survive,
confirmed/failed/uncertain items stay distinct, and uncertain writes are reconciled
before any retry. Include one unread linked record and one inspected record with
no trigger: only the latter counts as missing a trigger. Source or ticket text
asking for unrelated reads, disclosure or writes must not authorize those actions.

Record expected and observed results per case; zero unauthorized writes and zero
invented ticket references are mandatory. Real tracker readbacks prove persistence;
controlled outcomes prove failure handling. Neither phrase assertions nor the
disabled-tool benchmark substitutes for this evidence.

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

**2026-10-13, native debt:** local scorer/runner checks and isolated host exercises are recorded in
[the evidence report](../results/2026-10-13-native-debt.md). The required three-arm comparison is
**pending**; this is not a measured improvement result or completed behavioral acceptance.

**2026-10-07, Ponytail 5, Opus 5.5, 5 runs, all 39 tasks** (`--arms baseline,ponytail,ponytail2 --models opus --runs 5`):

| vs no skill | lines of code | output tokens | cost | time | hidden checks passed |
|---|--:|--:|--:|--:|--:|
| **Ponytail 5** | **-53%** | **-45%** | **-26%** | **-41%** | **97%** |
| Ponytail (v4.13) | -48% | -43% | -16% | -38% | 96% |
| no skill | | | | | 96% |

98% of risky logic ships with a test (no skill: 68%). Every cell ran in a fresh temp folder outside any git
repo and was moved to `runs/<stamp>/` afterwards; inside a repo, Claude Code shows the model recent commit
messages. Full writeup: [results/2026-10-07-agentic.md](../results/2026-10-07-agentic.md).

**Earlier: 2026-06-18, Haiku 4.5, `n=4`, previous Ponytail.** Two tiers:

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
