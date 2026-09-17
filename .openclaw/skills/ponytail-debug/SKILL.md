---
name: ponytail-debug
description: "Reproduce a reported failure, trace its root cause, and verify a focused fix while preserving security and existing behavior."
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

# Ponytail Debug

Fix the reported behavior with the smallest complete change. For a request
to diagnose or explain only, stop after reporting the root cause; do not edit.

## Debugging decision ladder

1. **Reproduce.** Read the failure and the affected project rules. Run the
   existing failing check, or make the smallest runnable reproduction. Record
   expected and actual results. If the required environment or input is
   missing, report that gap instead of inventing a failure or a fix.
2. **Locate the root cause.** Trace the failing input through the real code
   and inspect callers of the function to be changed. Identify the condition
   that violates the contract and the layer that owns it. A guard that hides
   an upstream error does not establish the cause.
3. **Patch within scope.** Reuse the existing implementation and project
   tools. Change only what corrects the demonstrated failure and affected
   callers. Do not refactor adjacent working code, add speculative abstractions,
   or introduce a dependency for the repair.
4. **Verify.** Rerun the reproduction and relevant existing checks. Preserve
   a small regression check when the failure was not already covered. Cover
   affected security and trust-boundary cases; never remove validation,
   accessibility, error handling, or data-loss protections to shorten the fix.

Report the cause with a file location, what now works, and the checks actually
run. Separate passing checks from unverified environments. Three failed repair
attempts: stop changing code, name the assumption that remains unsupported,
and request the missing diagnostic evidence.

`/ponytail-debug <failure or target>` is a task, not a change to the saved
intensity. `/ponytail debug` selects this workflow as the current mode on hosts
with mode switching; `PONYTAIL_MODE=debug` selects it at session startup.
