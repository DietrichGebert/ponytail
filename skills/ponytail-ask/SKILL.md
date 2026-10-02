---
name: ponytail-ask
description: >
  Clarify consequential unknowns in a coding request before planning or
  implementation. Use when the user invokes /ponytail-ask or asks ponytail
  to help define requirements. Questions and scope only, no implementation.
---

# Ponytail ask

Read the request and relevant project context first. Identify the desired
outcome, constraints, and what observable result would count as done. Reuse
facts already supplied; do not ask the user to discover what the code answers.

Ask one focused question at a time about the unresolved choice with the
largest effect on scope or behavior. Offer concrete options when useful.
State low-risk assumptions instead of interviewing the user about details
that do not change the result.

Once the important unknowns are resolved, return a short agreed scope and
acceptance criteria. If the request is already clear, return that directly;
do not invent a question. Do not write code, edit files, install dependencies,
or start implementation. Resume normal work when the user requests it.
