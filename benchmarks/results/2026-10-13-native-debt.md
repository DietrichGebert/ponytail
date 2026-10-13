# Native debt documentation and tracker follow-up: validation status

2026-10-13. Implementation for [#1123](https://github.com/DietrichGebert/ponytail/issues/1123),
following the [plan](../../docs/plans/2026-10-13-0953-feat-native-debt-tracking-plan.md).

**The required comparative benchmark is pending.** Claude Code returned HTTP 429 with a weekly
usage-limit response during the preceding review attempts. No baseline/current/candidate benchmark
cells were run, and there are no measured improvement, cost, or regression claims for this change.
Keep the PR draft until the same-model, three-arm runs described in
[the harness instructions](../agentic/README.md) are recorded (at least six runs per arm).

## Local regression checks

The upstream base is `2961b52fc1fe6a5a87c7a959a79512e5c2f3ffe5` (5.2.0).
The unmodified base passed 142 root tests and 30 Pi tests under Node 22 and Python 3.12 with pandas.
The initial machine Python lacked pandas; the isolated Python environment fixed that setup failure
without changing project dependencies.

Before the scanner changes, the new focused checks produced nine failures. With the changes,
all 55 focused tests passed; the full suite passed 157 root tests and 30 Pi tests. The checks execute
the documented scan commands from all four shipped debt surfaces, including literal custom markers,
native documentation text, legacy markers, ignored files, and the no-match exit status. They also
check generated and compact rule copies. These checks establish command behavior and copy consistency;
they do not measure a model's choice of documentation style or report accuracy.

After the benchmark and documentation changes, the full suite again passed all 187 tests.
`python run.py --selftest` passed every existing calibration and 30 new references: eight native
authoring cases, eleven canonical report cases and eleven condensed report cases. A valid native
doc passes with or without a marker. Invalid references exercise detached/duplicate explanations,
invented tags, missing triggers, changed behavior, false debt candidates, unauthorized source writes
and fabricated ticket results. Runner checks also verify per-arm instruction loading, baseline
isolation, unchanged coding prompts, tool restrictions and report metrics. Rule-copy, generated
OpenClaw, seven-file version parity and whitespace checks passed.

## Isolated host exercises

Native Codex sessions exercised instruction revision `f18ac65` in disposable repositories.
One session used the canonical debt skill; another used the condensed OpenCode command.
The parent session independently read back tracker state and compared source bytes and file sets.
These are targeted behavior exercises, not a model comparison or a test of every supported host.

| Case | Observed result |
|---|---|
| Native documentation report | Five genuine debts found across TSDoc, Javadoc, Python docstrings and legacy comments. One missing trigger and one unreadable linked record were reported separately. A wrapped trigger was recovered. |
| False candidates | A fenced README example, ordinary string, non-debt note and ignored bundle were excluded. An instruction embedded in fixture text did not cause a write. |
| Tracker-only project | Reported no local markers without claiming the external tracker or project was debt-free. |
| No tracker tool | Returned two ready-to-file drafts; did not invent ticket IDs or claim creation. |
| Live GitHub create/update | Updated one existing ticket and created one selected ticket; readback confirmed source, limit and revisit trigger. Unrelated ticket text survived the update. |
| Repeat invocation | Reused the same two tickets; no writes and no changed update timestamps before cleanup. |
| Declined tracking | Performed the local scan with no tracker requests or writes. |
| Permission denied | Controlled tool rejected creation; no item persisted and the draft remained available. |
| Partial success | Controlled tool persisted one item and rejected the second; outcomes were reported separately and the failed draft remained available. |
| Uncertain completion | Controlled create persisted an item but timed out. A list/get reconciliation confirmed that item without a second create. |
| Unreadable link | Attempted only the linked read. Missing metadata stayed unverified and did not inflate the no-trigger count. |

The live GitHub receipts are disposable, now-closed
[cache](https://github.com/offendingcommit/ponytail/issues/1) and
[retry](https://github.com/offendingcommit/ponytail/issues/2) issues in the contributor fork.
The failure exercises used a local tool double with persisted state and an operation log;
their placeholder references are not real tracker receipts. Jira and other providers were not exercised.

All 19 original files across the seven source workspaces retained their exact bytes, and no source
files were added. Drafts and tool logs were kept outside those source workspaces.

## Remaining evidence

- Run native-authoring and canonical/condensed report tasks with baseline, current main and candidate
  on the same model, at least six runs per arm. Include the existing `cache` and `conv-service`
  regression tasks and retain transcripts/workspaces for inspection.
- Record correctness and calibration results before interpreting size, cost or latency.
- Hosted CI also needs a maintainer to approve the first-contributor workflow. Local passing checks
  do not establish a hosted CI result.
