---
name: ponytail-debt
description: "Harvest every ponytail: shortcut comment into one debt ledger, so deferrals get tracked instead of forgotten. One-shot report."
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

Every deliberate shortcut is marked with a `ponytail:` or `defer:` comment
naming its ceiling and upgrade path. This collects them into one ledger so a
deferral can't quietly become permanent.

## Scan

Grep the repo for comment markers, skipping `node_modules`, `.git`, and build
output:

`grep -rnE '(#|//) ?(ponytail|defer):' .`  (add other comment prefixes if your stack uses them)

Each hit is one ledger row. The comment prefix (`ponytail:` or `defer:`) keeps
prose that merely mentions the convention out of the ledger.

## Output

One row per marker, grouped by file:

`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.`

The convention is `ponytail: <ceiling>, <upgrade path>`, so pull the ceiling
and the trigger straight from the comment. Want an owner per row too? add
`git blame -L<line>,<line>`.

Flag the rot risk: any `ponytail:` or `defer:` comment that names no upgrade
path, no trigger condition, or no ceiling gets a `⚠ no-trigger` tag — these
are the ones that silently rot into permanent shortcuts.

Well-formed: `// defer: global lock. ceiling: single-tenant only. upgrade when: multi-tenant needed.`
Missing trigger: `// ponytail: using simple loop` ⚠ no-trigger — no ceiling or upgrade path named.

End with `<N> markers, <M> with no trigger.` Nothing found: `No debt markers. Clean ledger.`

## Boundaries

Reads and reports only, changes nothing. To persist it, ask and it writes the
ledger to a file (e.g. `PONYTAIL-DEBT.md`). One-shot. "stop ponytail-debt" or
"normal mode" to revert.
