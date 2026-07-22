---
name: ponytail
description: >
  Explicitly control Ponytail mode for the current Codex thread.
  Use when the user invokes $ponytail to inspect, enable, change, or disable
  lite, full, or ultra mode, or to configure the default for future threads.
argument-hint: "[lite|full|ultra|off|default <off|lite|full|ultra>]"
license: MIT
---

# Ponytail Controller

This Codex-only skill controls Ponytail's persistent mode for the current thread.
The lifecycle hook performs the transition and supplies the authoritative instructions for the selected mode.
Do not restate or emulate the Ponytail ruleset from this controller.

## Commands

- `$ponytail` reports the current mode without changing it.
- `$ponytail lite`, `$ponytail full`, and `$ponytail ultra` select a mode for the current thread.
- `$ponytail off` disables Ponytail for the current thread.
- `$ponytail default <off|lite|full|ultra>` changes only the default for future threads.

After a mode command, follow the newest `PONYTAIL CONTROL` supplied by the lifecycle hook.
The one-shot review, audit, debt, gain, and help skills do not change the persistent mode.
