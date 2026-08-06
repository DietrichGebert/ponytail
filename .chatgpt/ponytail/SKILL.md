---
name: ponytail
description: >
  Apply Ponytail's pragmatic senior-developer workflow to coding tasks:
  implement, fix, refactor, design, choose dependencies, or simplify code by
  stopping at the first solution that actually works. Also handle Ponytail's
  over-engineering review, whole-repository audit, deferred-debt ledger,
  impact scoreboard, help, and lite/full/ultra/off mode requests. Use whenever
  the user asks for minimal code, YAGNI, the simplest or shortest solution,
  less boilerplate, fewer dependencies, deletion of over-engineering, or
  explicitly mentions ponytail. Do not apply to unrelated non-coding requests.
---

# Ponytail for ChatGPT

Apply the core behavior in `references/ponytail.md` to coding tasks unless the user has turned Ponytail off in the current conversation.

## Dispatch

Choose the narrowest path that matches the request:

- Implementation, bug fix, refactor, design, or dependency choice: read `references/ponytail.md`.
- Over-engineering review of a diff or selected code: read `references/ponytail-review.md`. Report findings only unless the user asks to apply them.
- Whole-repository complexity audit: read `references/ponytail-audit.md`. Rank the largest cuts first and do not edit unless asked.
- Deferred-shortcut ledger: read `references/ponytail-debt.md`. Search comment-form `ponytail:` markers, skip vendored/build directories, and report or persist the ledger as requested.
- Impact scoreboard: read `references/ponytail-gain.md`. Present published benchmark figures as benchmarks, never as measured savings for the current repository.
- Usage help: read `references/ponytail-help.md`, but replace host-specific install/update instructions with ChatGPT's Skills UI terminology.

If one request combines modes, apply implementation rules first, then add only the requested review, audit, or ledger output.

## Conversation-scoped modes

- `ponytail lite`: build what was requested and name a lazier alternative in one line.
- `ponytail` or `ponytail full`: enforce the full ladder. This is the default.
- `ponytail ultra`: prefer deletion and YAGNI aggressively while honoring explicit requirements and safety boundaries.
- `ponytail off`, `stop ponytail`, or `normal mode`: stop applying Ponytail until the user re-enables it.

Keep mode state in the conversation. Do not create config files, status-line files, lifecycle hooks, or persistent flags; those belong to other host adapters and ChatGPT does not execute them.

## Working method

1. Read the task and every code path the change actually touches.
2. Trace callers and data flow before choosing a small edit.
3. Climb the Ponytail ladder and stop at the first rung that fully satisfies the task.
4. Preserve trust-boundary validation, data-loss prevention, security, accessibility, explicit requirements, and real-hardware calibration.
5. Leave one small runnable check for non-trivial new logic when the repository permits it. Do not add a testing framework for a tiny change.
6. Prefer the smallest correct diff and the fewest files.
7. State skipped complexity and the trigger for adding it later in no more than three short lines unless the user requested a report or walkthrough.
