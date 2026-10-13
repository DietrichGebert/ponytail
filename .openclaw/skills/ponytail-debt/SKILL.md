---
name: ponytail-debt
description: "Harvest every shortcut: comment into one debt ledger, so deferrals get tracked instead of forgotten. One-shot report."
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

Deliberate shortcuts use the project's comment or documentation style to name
their ceiling and upgrade path, normally with `shortcut:` (older code may say
`ponytail:`). This collects those source records into one ledger so a deferral
can't quietly become permanent. Honor project guidance choosing another marker,
no marker, or tracker-only records; a scan never adds markers.

## Scan

Grep the repo for candidate marker text, skipping `.git` and everything the
`.gitignore` files ignore (dependencies, build output, caches, in any stack):

`git grep --no-index --exclude-standard -nF -e 'shortcut:' -e 'ponytail:'`

For a custom marker word (`/ponytail-debt TODO`), use the word without a trailing
colon as the `marker` environment variable, supplied as data through the host's
tool API or safely shell-quoted; never paste user text into shell program text.
Then run `git grep --no-index --exclude-standard -nF -e "$marker:"` instead. This
adds the colon once and treats regex metacharacters literally.

Exit 1 means no candidates; report any other nonzero exit as a scan failure.
Each hit is only a candidate. Read its enclosing source, including documentation
openers, continuation lines and docstrings, before admitting a row. Exclude
illustrative prose/examples, ordinary string data and non-deferrals such as
keyboard-shortcut explanations. Read wrapped text before deciding a trigger is
missing; a grep expression is not a language parser.

## Output

One row per inspected debt marker, grouped by file, keeping the marker's source location:

`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.`

The convention is `shortcut: <ceiling>, <upgrade path>`, so pull the ceiling
and the trigger straight from the complete source note. Want an owner per row too? add
`git blame -L<line>,<line>`.

Flag the rot risk: any inspected source record that names no upgrade path or
trigger gets a `no-trigger` tag, those are the ones that silently rot.

End with `<N> markers, <M> with no trigger.` Nothing found:
`No local shortcut debt markers found.` This makes no claim about project-wide
or tracker debt.

## Boundaries

Reads and reports only, changes nothing. To persist it, ask and it writes the
ledger to a file (e.g. `PONYTAIL-DEBT.md`). One-shot. "stop ponytail-debt" or
"normal mode" to revert.
