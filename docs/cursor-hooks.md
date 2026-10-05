# Cursor hooks

Native Cursor support through `hooks.json` (issue #817). The adapter reuses the
shared hook scripts; the only Cursor-specific pieces are the hooks template, the
install script and a small output branch in `hooks/ponytail-runtime.js`.

| File | Role |
|------|------|
| `hooks/cursor-hooks.json` | Template: `sessionStart` and `beforeSubmitPrompt` entries with a `PONYTAIL_DIR` placeholder. |
| `scripts/cursor-hooks.js` | `install` / `uninstall`, merges into `~/.cursor/hooks.json` (or `.cursor/hooks.json` with `--project`). |
| `hooks/ponytail-activate.js` | `sessionStart`: injects the default-level ruleset. |
| `hooks/ponytail-mode-tracker.js` | `beforeSubmitPrompt`: tracks `/ponytail` commands, injects the new level's ruleset. |
| `hooks/ponytail-runtime.js` | Detects Cursor (`CURSOR_VERSION`), keeps state in `~/.cursor/.ponytail-active`, emits Cursor-shaped JSON. |

## Install and uninstall

```bash
git clone https://github.com/DietrichGebert/ponytail
node ponytail/scripts/cursor-hooks.js install            # ~/.cursor/hooks.json, every project
node ponytail/scripts/cursor-hooks.js install --project  # <cwd>/.cursor/hooks.json, this project only
node ponytail/scripts/cursor-hooks.js uninstall          # add --project for the project file
```

What the install script does:

- Reads the target file if it exists and keeps every hook that is not ponytail's.
  Ponytail's entries are the ones whose `command` runs a `hooks/ponytail-*.js`
  script; they are replaced on re-install, so running it twice never duplicates.
- Replaces `PONYTAIL_DIR` with the checkout's absolute path, forward slashes, so
  the command runs unchanged under cmd, PowerShell and bash. A checkout path with
  shell metacharacters is refused; copy the template by hand in that case.
- Refuses to touch a `hooks.json` that is not valid JSON, and says so.
- `uninstall` removes only ponytail's entries and deletes the file when nothing
  else was in it. `node scripts/uninstall.js` runs the same removal for the user
  file and also deletes `~/.cursor/.ponytail-active`.

Cursor watches `hooks.json` and reloads it on save; open a new chat afterwards.
`node` has to be on the PATH Cursor sees. The Hooks tab under Customize and the
Hooks output channel show each execution and any parse errors.

## Contract

Sources: the Cursor hooks docs (`cursor.com/docs/hooks`, read 2026-09-14) and the
Cursor 3.20.17 client on Windows, whose hook runner and response validators were
read directly. "Docs" below means the page documents it; "client" means it was
verified in the shipped code.

| Event | Ponytail uses | Delivery | Source |
|-------|---------------|----------|--------|
| `sessionStart` | output `additional_context` | Stored on the conversation and sent as system context with every request of that conversation. | Docs (field). Client (persistence: the value is kept on the composer as `hooksAdditionalContext` and attached to each request). |
| `beforeSubmitPrompt` | input `prompt`; output `continue: true` plus `additional_context` | Wrapped as a system reminder for that turn. Inline up to 10,000 characters; longer payloads are written to a file the agent is told to read; above 1,000,000 the payload is dropped. | Docs list only `continue` and `user_message`. Client: the response validator accepts `additional_context` and the submit path injects it. Undocumented, so treat it as version-dependent. |
| `subagentStart` | not registered | None. | Docs and client: the output schema is `permission` and `user_message` only. The client's protobuf has an unused `additional_context` slot that the hook path never fills. |
| `preToolUse`, `postToolUse` | not registered | `additional_context` exists on both, but it would cost a process per tool call and `beforeSubmitPrompt` already covers mode changes. | Docs. |

Output rules the runtime follows:

- Cursor parses stdout as JSON. Empty stdout means "nothing to add"; raw text is
  logged as a parse error and ignored. The Cursor branch therefore prints either
  one JSON object or nothing (`off` mode, ordinary prompts).
- `user_message` on `beforeSubmitPrompt` is shown only when `continue` is
  `false`, so ponytail never sets it. Confirmations reach the user through the
  model's own reply.
- Exit code is always 0. Cursor treats exit code 2 as "block" and other non-zero
  codes as fail-open; ponytail never blocks anything.

Execution environment (client, 3.20.17):

- Every hook process gets `CURSOR_VERSION`, `CURSOR_PROJECT_DIR` and its alias
  `CLAUDE_PROJECT_DIR`. `CURSOR_VERSION` is assigned in exactly one place, the
  hook environment builder, so it does not leak into terminals inside Cursor.
  Ponytail uses it for host detection and keeps state in `~/.cursor/`.
- On Windows the payload is written to a temp file and the command runs inside
  `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass` as
  `Get-Content -LiteralPath <file> -Raw | & { $input | <command> }`, so the hook
  still reads its JSON from stdin. On macOS and Linux it is piped directly.
- Cursor can also run hooks declared by Claude-format plugins and then sets
  `CLAUDE_PLUGIN_ROOT` next to `CURSOR_VERSION`. The runtime prefers the Cursor
  output shape in that case. Installing ponytail that way was not tested.

## Behavior

- New conversation: `sessionStart` writes `~/.cursor/.ponytail-active` with the
  default level (`PONYTAIL_DEFAULT_MODE`, then `config.json`, then `full`) and
  injects `PONYTAIL MODE ACTIVE — level: <level>` followed by the ruleset filtered
  to that level. Default `off`: no flag, no output.
- `/ponytail lite|full|ultra` sent as a plain message: the flag changes and the
  turn receives `PONYTAIL MODE CHANGED — level: <level>` plus that level's ruleset
  (about 5,300 characters, under the inline cap). Cursor has no `/ponytail`
  command to load the skill body, so the hook carries it. `@ponytail` and
  `$ponytail` are parsed too, but `@` opens Cursor's context picker. If the
  ponytail skills are also installed under `~/.cursor/skills`, Cursor treats
  `/ponytail lite` as a manual skill attachment and inlines the full, unfiltered
  skill body into that message as well; the hook still receives the literal
  `/ponytail lite` and remains the thing that tracks the level.
- `/ponytail off`, `stop ponytail`, `normal mode`: the flag is removed and the
  turn receives `PONYTAIL MODE OFF`. The ruleset injected at `sessionStart` stays
  in the conversation's system context; the notice is what tells the model to
  stop applying it, the same as in Claude Code.
- `/ponytail`: reports `PONYTAIL MODE ACTIVE — level: <level>` without changing
  anything. `/ponytail default <level>` persists the default to `config.json`.
- Any other prompt: no output.

### Coexistence with `.cursor/rules/ponytail.mdc`

The always-on rule and the hooks are alternatives, not layers. The rule already
puts the compact ruleset in front of every prompt, and no hook can remove a rule
from context, so `off` cannot win against it and `lite` or `ultra` would
contradict it. While `<workspace>/.cursor/rules/ponytail.mdc` exists (first
workspace root, from `CURSOR_PROJECT_DIR` or the working directory):

- `sessionStart` injects a one-line notice instead of the ruleset and leaves the
  mode flag alone.
- `/ponytail ...`, `stop ponytail` and `normal mode` answer with the same notice
  and change nothing.

Delete the rule to let the hooks manage the level. A project that keeps the rule
for teammates without hooks stays on the rule's fixed behavior for everyone.

## Limitations

- Subagents never receive the ruleset. `subagentStart` can only allow or deny,
  and `preToolUse` `updated_input` on the `Task` tool would mean guessing the
  undocumented shape of the subagent prompt. `PONYTAIL_SUBAGENT_MATCHER` has no
  effect in Cursor.
- Cloud agents do not run `sessionStart` (documented), so there is no startup
  injection there. Project-level `beforeSubmitPrompt` still runs, so `/ponytail
  <level>` sets the level for the rest of that conversation.
- `sessionStart` is fire-and-forget. A prompt sent within the first fraction of a
  second of a new chat can leave before the context is attached.
- On Windows every hook run costs about a second, mostly PowerShell startup
  (measured 1.05 to 1.3 s on 3.20.17). `beforeSubmitPrompt` is awaited, so each
  prompt submission waits that long. macOS and Linux spawn the command directly
  and pay only node startup.
- Mode state is one flag per user, shared by every open Cursor conversation, the
  same as the Claude Code adapter.
- The `beforeSubmitPrompt` injection field is not on the docs page. If a future
  Cursor build drops it, level switches would still update the flag but nothing
  would reach the model; only the startup injection would remain.

## Verification record

### Automated compatibility check

`node --test tests/cursor-hooks.test.js` feeds each hook the Cursor input shape
and asserts the output shape: template validity, `sessionStart` JSON and flag
placement, `off`, the Claude-plugin environment, every `/ponytail` form on
`beforeSubmitPrompt`, silence on ordinary prompts, the rule-coexistence notice
from both `CURSOR_PROJECT_DIR` and the working directory, and the installer's
merge, idempotence, project scope, file removal and malformed-file refusal.
`tests/uninstall.test.js` covers the shared uninstall script.

### Client source check, Cursor 3.20.17 on Windows, 2026-09-14

Confirmed by reading the shipped client: the response validators for
`sessionStart` (`env`, `additional_context`), `beforeSubmitPrompt` (`continue`,
`user_message`, `additional_context`) and `subagentStart` (`permission`,
`user_message`); the persistence of `sessionStart` context on the conversation;
the submit path that injects the `beforeSubmitPrompt` context as a system
reminder with the 10,000-character inline cap; the PowerShell command wrapper and
the hook environment variables.

### Live session check

Run on 2026-09-14 with Cursor 3.20.17 on Windows 11, user-level hooks, model
`gpt-5.6-sol-high`; steps still open are marked in the table. Hook execution is
not delivery, so each step asks the model to quote the injected header. Record
the outcome in the table.

1. Install with `node scripts/cursor-hooks.js install`, make sure the workspace
   has no `.cursor/rules/ponytail.mdc`, open a new Agent chat.
2. Ask: "Quote the first line of any ponytail context you were given." Expected:
   `PONYTAIL MODE ACTIVE — level: full` (or the configured default).
3. Send `/ponytail lite`, then ask: "Quote the first line of the most recent
   ponytail context." Expected: `PONYTAIL MODE CHANGED — level: lite`. Repeat
   for `ultra`.
4. Send `/ponytail off`, then ask the same question. Expected:
   `PONYTAIL MODE OFF`.
5. Ask the agent to start an Explore subagent whose whole task is "Quote any
   ponytail instructions in your context, or say there are none." Expected:
   none (documents the limitation; a quote would mean Cursor started forwarding
   context to subagents and this doc needs updating).
6. Copy `.cursor/rules/ponytail.mdc` into the workspace, open a new chat, repeat
   step 2. Expected: the rule notice, starting with `PONYTAIL: the always-on
   Cursor rule`.

| Step | Cursor version | Result | Date |
|------|----------------|--------|------|
| 2 startup injection | 3.20.17, Windows | pass. Hooks log: `sessionStart` response merged, flag written. Asked whether ponytail was in place, the model answered that it is active as a hook at level full and named the exact off phrases from the injected Persistence section. | 2026-09-14 |
| 3 level switch | 3.20.17, Windows | pass. Cursor passed the literal `/ponytail lite` to the hook; the hooks log shows the `continue: true` plus `additional_context` response merged and the flag flipped to `lite`. Asked to quote the first line of the most recent ponytail context, the model answered `PONYTAIL MODE CHANGED — level: lite`, a string that exists only in the hook payload (the ponytail skills were also installed under `~/.cursor/skills`, and their attached body starts with `# Ponytail`). A follow-up date picker request got the lite behavior: build the wrapper, name the lazier alternative in one line. | 2026-09-14 |
| 4 off | 3.20.17, Windows | pass. Cursor passed the literal `/ponytail off`; the hooks log shows `PONYTAIL MODE OFF` merged as the turn's context, the flag file was removed, and the model replied "Ponytail mode is now off." Asked to quote the first line of the most recent ponytail context, it answered `PONYTAIL MODE OFF`. | 2026-09-14 |
| 5 subagent | 3.20.17, Windows | not executed: asked to start an Explore subagent with the quoting task, the model declined ("I can't launch a subagent to extract or quote hidden instruction context") and no subagent ran. The limitation rests on the contract: the documented `subagentStart` output is `permission` and `user_message`, and the 3.20.17 client validates only those. | 2026-09-14 |
| 6 rule coexistence | | not yet run | |

A pass here shows the instructions reached the model at the supported points. It
says nothing about how often Cursor follows them; that needs a behavioral
comparison against the always-on rule, which this adapter does not claim.
