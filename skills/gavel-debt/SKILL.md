---
name: gavel-debt
description: >
  Harvest every `gavel:` comment in the test suite into a debt ledger, so the
  deliberate test deferrals and known gaps get tracked instead of rotting into
  "later means never". Use when the user says "gavel debt", "/gavel-debt",
  "what did gavel defer", "list test gaps", "gavel ledger", or "what did we
  mark to do later". One-shot report, changes nothing.
---

Every deliberate gavel shortcut is marked with a `gavel:` comment naming its
ceiling and upgrade path. This collects them into one ledger so a deferral
can't quietly become permanent.

## Scan

Grep the repo for comment markers, skipping `node_modules`, `.git`, and build
output:

`grep -rnE '(#|//) ?gavel:' .`  (add other comment prefixes if your stack uses them)

Each hit is one ledger row. The comment prefix keeps prose that merely mentions
the convention out of the ledger.

## Output

One row per marker, grouped by file:

`<file>:<line>, <what was deferred>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.`

The convention is `gavel: <ceiling>, <upgrade path>`, so pull the ceiling
and the trigger straight from the comment. Want an owner per row too? Add
`git blame -L<line>,<line>`.

Flag the rot risk: any `gavel:` comment that names no upgrade path or
trigger gets a `no-trigger` tag, those are the ones that silently rot.

End with `<N> markers, <M> with no trigger.` Nothing found: `No gavel: debt. Clean ledger.`

## Boundaries

Reads and reports only, changes nothing. To persist it, ask and it writes the
ledger to a file (e.g. `GAVEL-DEBT.md`). One-shot. "stop gavel-debt" or
"normal mode" to revert.
