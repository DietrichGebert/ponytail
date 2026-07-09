---
description: "Harvest ponytail: comments into a tracked debt ledger"
---

Harvest every `ponytail:` comment in this repository into a debt ledger so deferrals do not rot into 'later means never'. Grep the whole tree for comment markers (grep -rnE '(#|//) ?ponytail:' ., skipping node_modules/.git/build output). One row per marker, grouped by file: <file>:<line>, <what was simplified>. ceiling: <the limit named in the comment>. upgrade: <the trigger to revisit>. Tag any marker that names no upgrade path or trigger as no-trigger, those rot silently. End with the count of markers and how many lack a trigger. If none: 'No ponytail: debt. Clean ledger.' Report only, change nothing.
