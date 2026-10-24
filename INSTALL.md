# Install

Crewcut supports Claude Code and GitHub Copilot. Both plugins run small Node.js lifecycle hooks, so `node` must be on the PATH of a non-interactive shell. Without it, the skills still work, but every hook call shows a harmless `node: command not found` error.

## Claude Code

```
/plugin marketplace add HermitOS/crewcut
```
```
/plugin install crewcut@crewcut
```
(Send these as two separate prompts.)

In the Claude Code Desktop app's Code tab, type the same two `/plugin` commands, or click **+** next to the prompt box and choose **Plugins** → **Add plugin**.

## GitHub Copilot CLI

```bash
copilot plugin marketplace add HermitOS/crewcut
copilot plugin install crewcut@crewcut
```

In an interactive Copilot CLI session, use the slash equivalents:

```
/plugin marketplace add HermitOS/crewcut
/plugin install crewcut@crewcut
```

Copilot CLI namespaces plugin commands by plugin name, for example `/crewcut:crewcut ultra` or `/crewcut:crewcut-review`.

Instruction-only fallback: Copilot CLI reads `AGENTS.md` and `.github/copilot-instructions.md` in a project. Copy the rules into `~/.copilot/copilot-instructions.md` to use crewcut in every project. This gives always-on guidance, but no mode switches or hooks.

## GitHub Copilot Chat (VS Code, Visual Studio, JetBrains)

Copy [`.github/copilot-instructions.md`](.github/copilot-instructions.md) into your project's `.github/` folder.

## Settings

Set the level for every new session with the `CREWCUT_DEFAULT_MODE` env var (`lite`/`full`/`ultra`/`off`), or a `defaultMode` field in `~/.config/crewcut/config.json` (`%APPDATA%\crewcut\config.json` on Windows). The default is `full`.

While active, the ruleset is also injected into every subagent spawned via the Agent tool. To limit that to specific agent types, set the `CREWCUT_SUBAGENT_MATCHER` env var to a regex tested against the subagent's `agent_type`. It is unanchored and case-insensitive: `explore|general` matches either, `^general$` is exact, and plugin agent types look like `plugin:name`. Unset means inject into every subagent (the default). An invalid regex, or a subagent whose type the platform doesn't report, also falls back to injecting.

## Uninstall

| Host         | Command                                |
|--------------|----------------------------------------|
| Claude Code  | `/plugin remove crewcut`               |
| Copilot CLI  | `copilot plugin uninstall crewcut`     |
| Copilot Chat | Delete the copied instructions file    |

These remove the plugin's own files. They leave some state crewcut writes outside the plugin folder: the mode flag (`~/.claude/.crewcut-active`), `~/.config/crewcut/config.json`, the statusline script copy (`~/.claude/crewcut-statusline.sh` or `.ps1`), and, if you accepted the setup nudge, a `statusLine` entry in `~/.claude/settings.json`. Run `node scripts/uninstall.js` to remove the files. **Run it before the remove command above**: the script is a plugin file, so removing the plugin first deletes it (or run it from a separate clone of this repo). It does not read or change `settings.json`, which can hold credentials. Remove the crewcut `statusLine` entry there by hand.
