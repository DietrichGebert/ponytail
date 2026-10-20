# Ponytail for DeepSeek Harness

A Host + Web-client bundle for DeepSeek Harness (dsh). It reuses the existing
`skills/` and `hooks/` in this checkout; it does not fork the prompt.

## What you get

- A per-step `systemPrompt` section carrying the Ponytail ruleset at the active
  level (empty when the level is `off`).
- `/ponytail` with `lite`, `full`, `ultra`, `off`, `status`, and
  `default <mode>`.
- The six skills as runtime skills: `/ponytail-review`, `/ponytail-audit`,
  `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`, and the model-facing
  `ponytail` skill. The bare `/ponytail` name stays a command.
- A small Web composer mark showing the icon and the active level word. Click
  it to cycle `full → ultra → lite → full`; when the level is `off` the mark is
  dimmed, shows `OFF`, and one click turns it on at `full`.
- Per-session level state derived from the `/ponytail` command log, so resume
  and fork restore it without a new session event type.

## Install

The dsh bundle is the `dsh-plugin/` subdirectory package (`dsh-ponytail`). It
depends on the root `@dietrichgebert/ponytail` package for `hooks/` and
`skills/`; there is no second copy of the prompt. A local checkout uses the
parent directory directly, so edits are live.

### DeepSeek Harness Web / Desktop

Open **Plugins** in the sidebar, choose **Add plugin**, enter the Git address

```text
github:DietrichGebert/ponytail#path:/dsh-plugin
```

and click **Install**. The wizard reads the subdirectory package `dsh-ponytail`,
installs it with its root dependency, and enables the bundle.

### dsh CLI

```bash
dsh plugin --profile web add "github:DietrichGebert/ponytail#path:/dsh-plugin"
```

Then start or keep the web UI:

```bash
dsh web
```

`dsh plugin add` installs the bundle package and selects it; no separate enable
step is needed. The plugin-manager `install_bundle` action with the same spec
is the agent-tool equivalent.

### From a local checkout

```bash
dsh plugin --profile web add "dsh-ponytail@link:/absolute/path/to/ponytail/dsh-plugin"
```

The `name@link:` prefix is required with pnpm 12; a bare local path is rejected.

### Update

- Git install: re-run the same `dsh plugin add` command.
- Local link: `git pull`; the link serves the new files. Restart or refresh if the Host or client module changed.

Verify the composed profile contains the row:

```bash
dsh --profile web --dump-config
```

## Verify

1. Open a session. The composer tool row shows the mark with `FULL`.
2. Click it: the word becomes `ULTRA`, then `LITE`, then `FULL`.
3. Type `/ponytail off`: the mark dims and reads `OFF`. Click it to turn it
   back on at `FULL`.
4. Type `/ponytail` in the composer: the `/` menu lists the `ponytail`
   command and the five `ponytail-*` skills.
5. In a model turn, the system prompt carries `PONYTAIL MODE ACTIVE — level:
   <mode>` from the current level.

The unit tests cover the argument parser, the projection fold, and the skill
reader:

```bash
node --test tests/dsh-plugin.test.js
```

## Limits

- `dsh-plugin/` depends on the root `@dietrichgebert/ponytail` package for `hooks/` and `skills/`, so the prompt has one source. A local checkout reads the parent directory; a Git subdirectory install resolves the dependency.
- `AGENTS.md` still loads in dsh. If it already carries the Ponytail rules,
  the plugin adds a second copy; prefer one or the other.
- Compaction replays the last committed `system/message`, so a level change
  made while a compaction request is in flight can lag one summary call.
- A child agent gets the global section with its own default level; a
  per-session override is not inherited by subagents.
- Command input is a hint only; dsh has no custom argument-completion hook.

## Uninstall

Use the Web **Plugins** page, or:

```text
plugin_manager({ action: "remove_bundle", target: "dsh-ponytail" })
```

With the CLI, `dsh plugin --profile web remove dsh-ponytail` removes the
package and its bundle selection.
