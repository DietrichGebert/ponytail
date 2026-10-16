# ZCode hooks

ZCode reads `.zcode-plugin/plugin.json`, which registers only
`hooks/zcode-hooks.json`. Do not also copy the Claude/Codex hook map into the
standard `hooks/hooks.json` location: that creates another registration path.

The adapter is a synchronous process hook. ZCode sends JSON on stdin and the
adapter invokes the existing activation or mode-tracking script with a private
child environment. `PLUGIN_DATA` selects the existing JSON output contract;
it is not exported into ZCode or other processes. No rule text or mode-command
parser is duplicated.

- `SessionStart`: startup/clear initialize the configured default; compact keeps
  the live mode, including off.
- `UserPromptSubmit`: ordinary requests are silent; mode commands inject the new
  rules, and `stop ponytail` / `normal mode` turn injection off.
- ZCode's documented events do not include `SubagentStart`. This adapter does not
  claim automatic subagent inheritance.

## State and configuration

Mode flags live below `ZCODE_PLUGIN_DATA/sessions/<sha256(session_id)>/`.
Two sessions in the same workspace remain independent; opaque IDs cannot escape
that directory. Missing session IDs, unsupported events, invalid JSON, and missing
absolute plugin-data paths fail with a diagnostic on stderr, without stdout
context or writes to a shared fallback location.

Defaults live below `ZCODE_PLUGIN_DATA/config/ponytail/config.json` instead of the
shared `~/.config/ponytail/config.json`. `PONYTAIL_DEFAULT_MODE` still takes
precedence. `/ponytail default ...` affects future ZCode sessions only. Mode
files are small and are retained with plugin data; no session-pruning job is
installed.

The wrapper limits the child to five seconds and 256 KiB output; the manifest
allows seven seconds for wrapper overhead. Diagnostics stay on stderr, and
nonempty stdout must be valid JSON. Failure is visible to ZCode rather than
silently reporting activation.

## Install and verify

Use ZCode's plugin manager to add a marketplace pointing to this checkout, then
install and enable `ponytail@ponytail`. Enable the user hooks switch and open a
new session. Existing sessions snapshot their hook configuration. Enabling the
master switch also activates hooks from other already-enabled plugins; inspect
them before changing it.

If the desktop app was already running when the CLI installed the plugin, refresh
its plugin activation in the desktop plugin manager before opening a new test
session. Check the actual session hook list, not only the installed-plugin list.

Do not combine plugin hooks with a user hook copy or an always-on AGENTS.md copy
of Ponytail. Merely installing skills does not prove automatic activation.

Run the isolated contract test:

```sh
node --test tests/zcode-hooks.test.js
```

For real-host acceptance, inspect outgoing model I/O, not only the model's claim
that Ponytail is enabled. Verify one startup ruleset, a full-to-ultra switch,
compact recovery, off followed by compact, and another full-mode session in the
same workspace. Treat the compacted summary's historical mention of a mode
separately from new hook injection. Compare Codex config and installed-hook
hashes before and after.

## Known host limitation: ZCode 3.15.3 / CLI 0.16.9

Real desktop GLM-5.3 verification showed that manual `/compact` succeeds but does
not fire SessionStart again. The mode file stays correct and the summary can
remember the level, while the next model request lacks the full ruleset. A model
saying it is still in ultra is not proof of rule restoration.

Automatic restoration therefore requires the host to emit the documented compact
lifecycle event. On this version, explicitly send `/ponytail ultra` (or the
intended level) after compacting to inject that level again. The adapter does not
append the full rules on every ordinary turn merely to hide this limitation.

When validating the desktop OAuth route, use the desktop host or faithfully
synchronize its account-provider snapshot. An independent app-server without that
snapshot can expose only personal providers and choose a different default model;
that is not evidence that the desktop account is broken.
