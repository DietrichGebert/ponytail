# Cursor native hooks

This adapter sends the shared Ponytail ruleset through Cursor's
`sessionStart.additional_context`. Support is **startup-only**: mode changes
require a new conversation. It does not write Claude Code or Codex state.
The static `.cursor/rules/ponytail.mdc` remains an alternative for fixed guidance.

## Install in a project

Requires Node.js on Cursor's hook PATH and a Cursor host with `sessionStart`.
Use a trusted local workspace. Hosted cloud agents currently do not run
`sessionStart`, so this adapter does not activate there. Keep the checkout at
the same path while installed.

```sh
git clone https://github.com/DietrichGebert/ponytail.git
cd ponytail
node scripts/cursor.js install /absolute/path/to/your-project
```

The installer merges the [template](../hooks/cursor-hooks.json) into the target
project's `.cursor/hooks.json`, substituting this checkout's absolute path:

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      { "command": "node \"/absolute/path/to/ponytail/hooks/ponytail-cursor.js\"" }
    ]
  }
}
```

Do not copy this example over existing hooks. The installer preserves unrelated
events, entries and settings, and refuses malformed or unknown config versions.
Reinstall replaces only this checkout's exact command; commands chained with
other scripts remain untouched. Uninstall from the old checkout before moving
it, to avoid duplicate registrations. User hooks in `~/.cursor/hooks.json` are
not modified.

### Migrate the always-on rule

Installation refuses an existing `.cursor/rules/ponytail.mdc`. Move it outside
the rules directory first, preserving your content. From the target project on
macOS/Linux, for example:

```sh
mv -n .cursor/rules/ponytail.mdc .cursor/ponytail.mdc.disabled
```

Check that the move succeeded; never overwrite a pre-existing backup. On Windows,
use your file manager. Also disable other Ponytail copies in `AGENTS.md`, user
rules or other hook sources, keeping unrelated project instructions. The
installer cannot discover every alternate copy. Another always-on copy can
duplicate instructions and undermine `off`. Start a **new chat** after migration;
old context cannot be retracted.

## Modes and platform limits

Without a mode argument, startup uses the shared resolver: `PONYTAIL_DEFAULT_MODE`,
then Ponytail's `config.json` `defaultMode`, then `full`. The environment must be
available to Cursor itself. Only `lite`, `full`, `ultra`, and `off` are defaults.
Set a project-specific startup mode by running the installer again:

```sh
node scripts/cursor.js install /absolute/path/to/your-project lite
node scripts/cursor.js install /absolute/path/to/your-project full
node scripts/cursor.js install /absolute/path/to/your-project ultra
node scripts/cursor.js install /absolute/path/to/your-project off
```

Each command adds `--mode <level>` to the hook for the **next new chat**. Shared
defaults for other agents stay unchanged. Reinstall without a mode to return to
shared defaults. `off` returns `{}` without instructions or state writes.
Existing chats retain their original context.

`/ponytail lite|full|ultra|off` is not a live hook command here. Subsequent prompts
receive no reinjection. `beforeSubmitPrompt` supports only submission control;
its `user_message` is not model context. `postToolUse.additional_context` is a
possible later delivery point, but misses prompts without successful tools and
the initial decisions in each turn. This adapter does not register that partial
substitute or guarantee persistence across context compaction.

`subagentStart` supports only allow/deny and a user-facing denial message.
`preToolUse` can modify tool input, but the docs do not establish a stable Task
prompt field or delivery to every built-in subagent. No subagent hook is
registered; automatic subagent delivery is **unsupported and unverified**.

## Uninstall

```sh
node scripts/cursor.js uninstall /absolute/path/to/your-project
```

Only this checkout's exact hook command is removed. Other hooks and settings
remain; an empty hooks object is retained if no hooks remain. Shared defaults
and rule backups are untouched. To return to fixed guidance, manually restore
the backup to `.cursor/rules/ponytail.mdc` after uninstalling. Start a new chat.

## Compatibility and session check

```sh
node --test tests/cursor.test.js
```

This executable check covers all defaults, environment/project overrides,
unsupported events, malformed input, changes between startups, `off`, isolation
from Claude/Codex state, rule migration, repeat installs and removal with other
hooks. It proves the adapter contract, not delivery to the model.

Live check record (2026-09-05): Cursor **3.19.10**, macOS arm64, was installed.
Two attempts to access its UI through the available automation returned
`timeoutReached`. No model-visible session result was collected. **Startup
delivery, subsequent prompts and new-chat mode changes remain unverified in
Cursor.** No subagent delivery claim is made. Complete this check before calling
the adapter runtime-verified:

1. Use a disposable project outside this checkout, without other Ponytail rules
   or hooks. Install `lite` and create a fresh Agent chat.
2. Without attaching files or asking the agent to read the installation, ask
   which Ponytail level and mode-specific intensity instructions it received in
   its initial context. Record its answer and Cursor version. Hook logs alone
   do not establish delivery.
3. Configure `ultra`, then send another prompt in that same chat and record that
   no replacement was injected. In a fresh chat, check the `ultra` instructions;
   repeat with `full` and `off`. An `off` chat should receive no Ponytail
   instructions. Do not attach the previous conversation.
4. Confirm that no subagent hook is registered. Do not infer child inheritance
   from the parent's answer. Any future subagent mechanism needs evidence from
   the child's own context before claiming parity.
5. Uninstall; verify unrelated hooks still work and a fresh chat no longer
   receives instructions from this adapter.

Delivery is separate from adherence. No increased activation or adherence over
the existing always-on rule is claimed.

Contract references (checked 2026-09-05): [Cursor hooks](https://cursor.com/docs/hooks)
(`sessionStart`, `beforeSubmitPrompt`, `postToolUse`, `subagentStart`, configuration
and cloud limits); [Cursor rules](https://cursor.com/docs/rules).
