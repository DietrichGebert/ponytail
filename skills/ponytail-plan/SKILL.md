---
name: ponytail-plan
description: >
  Create a minimal implementation plan or simplify an existing plan before
  coding. Use when the user asks for a ponytail plan, invokes /ponytail-plan,
  or asks to trim an over-engineered plan. Planning only, no implementation.
---

# Ponytail plan

Read the request, relevant project rules, and existing code before planning.
Preserve the requested outcome and constraints. Prefer existing code, standard
library, native features, and installed dependencies before proposing new code.

Return the smallest sequence of concrete changes that achieves the outcome,
with the affected paths and a runnable check that would catch a broken result.
For an existing plan, remove speculative steps and redundant layers; explain
material cuts without silently dropping requirements or safety checks.

State important assumptions. Ask only when a missing decision materially
changes the plan and cannot be answered from the project. If no change is
needed, explain what already meets the request.

Planning only: use the host's plan review mechanism when required; otherwise
present the plan in the response. Do not implement, install,
commit, or write a plan file unless the user requests that action. A later
implementation request is a separate task; do not keep planning mode active.
