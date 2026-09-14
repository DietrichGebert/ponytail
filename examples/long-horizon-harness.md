# Ponytail inside a long-running task

This is a documentation example, not a benchmark result or a bundled integration.
[LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness)
coordinates a task across rounds; Ponytail guides the coding choices within
an Executor round. Neither requires replacing the underlying agent runtime.

## Responsibility map

| Layer | Responsibility | Ponytail's place |
|---|---|---|
| Manager | Recover the goal and verified progress; assign a bounded step | Preserve the requested outcome and acceptance criteria |
| Fresh-context Executor | Carry out the assigned step | Read Ponytail's rules each coding round; prefer reuse and contained complexity |
| Independent Auditor | Inspect actual files, behavior, and checks | Verify correctness and requirements; a shorter diff is not proof of success |
| Durable verified state | Carry accepted evidence into the next round | Record verified results and remaining work, not merely the Executor's claims |

These responsibilities follow the upstream
[lifecycle description](https://github.com/AMAP-ML/LongHorizon-Harness/blob/a1dd930614972b92361c1b9cd6aac441a6db5a65/README.md#one-loop-three-focused-responsibilities).
Ponytail's [`ponytail-audit`](../skills/ponytail-audit/SKILL.md) only reviews
complexity; it does not replace the harness's independent Auditor.

## Instruction-only example

1. In a workspace you control, make the existing
   [Ponytail skill](../skills/ponytail/SKILL.md) available at
   `.agents/skills/ponytail/SKILL.md`. Preserve any existing file and project
   rules. This uses the skill as readable instructions, with no Ponytail hook
   or automatic plugin-discovery assumption.
2. Include the following in your task text, alongside the concrete work,
   permitted paths, and acceptance checks:

   ```text
   For every coding Executor round, first read
   .agents/skills/ponytail/SKILL.md in the workspace and apply its coding rules.
   Keep the assigned task's requirements, project rules, and permission limits.
   Report the changed paths and actual verification evidence.
   The independent Auditor must check the acceptance criteria against the
   resulting files and behavior. Fewer lines do not satisfy a missing requirement.
   ```

3. For an already configured harness, put the complete task in `task.md` and
   use its documented task-file entry point: `lh-harness run --task @task.md`.
   Review workspace and backend permissions before running: this starts real
   agent work. See upstream [usage](https://github.com/AMAP-ML/LongHorizon-Harness/blob/a1dd930614972b92361c1b9cd6aac441a6db5a65/README.md#common-cli-options).

The upstream [Executor prompt builder](https://github.com/AMAP-ML/LongHorizon-Harness/blob/a1dd930614972b92361c1b9cd6aac441a6db5a65/src/lh_harness/role_prompts.py)
includes the original task in each Executor prompt. Check the first round's
trajectory for the skill read and the Auditor's independent evidence before
relying on this composition. It has not been tested here as an end-to-end run.

Keep the harness's read-only auditing and approval boundaries. Loading Ponytail
does not authorize publishing, destructive changes, or broader access. A failed
check remains unfinished work; only independently accepted results belong in
verified progress.
