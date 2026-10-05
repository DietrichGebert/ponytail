# Install

Pick your agent below. Not listed? Most agents read [`AGENTS.md`](AGENTS.md): copy it into your project, or ask your agent to install [`skills/ponytail/SKILL.md`](skills/ponytail/SKILL.md) as a skill. Which files map to which agent: [Agent portability](docs/agent-portability.md).

The Claude Code and Codex plugins (and the Cursor hooks) run two tiny Node.js lifecycle hooks, so `node` needs to be on your PATH (note for Nix/nvm users: it must be on the non-interactive shell's PATH). If it isn't, the skills still work, but every hook call shows a harmless `node: command not found` error; installing Node (or putting it on that PATH) makes it go away.

## Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
(You have to send two separate prompts for the install to work) 

Same steps in the Claude Code Desktop app's Code tab: type the two `/plugin` commands above into the prompt box, or click the **+** button next to it, choose **Plugins** → **Add plugin** to browse your configured marketplaces, and manage marketplaces from **Customize** in the sidebar.

CodeBuddy installs the same plugin with the same two `/plugin` commands and switches levels with `/ponytail ultra` and so on; it has no subagent injection.

## Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

Run `codex` and open `/hooks`, review and trust its two lifecycle hooks, and start a new thread.

This same install also covers the Codex desktop app: restart the app after installing and it picks up the plugin.

## GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

In an interactive Copilot CLI session, use the slash equivalents:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI namespaces plugin commands by plugin name. For example:

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

## Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

## Oh My Pi (omp)

```bash
omp plugin marketplace add DietrichGebert/ponytail
omp plugin install ponytail@ponytail
```

omp runs ponytail's Pi extension unchanged, so the ruleset is injected every turn as in Pi (verified with omp 18.6.1). Start a new session after installing.

## OpenCode

Add to `opencode.json`:

```json
{ "plugins": ["@dietrichgebert/ponytail"] }
```

Run from a checkout instead (the plugin reuses `hooks/` and `skills/`):

```json
{ "plugins": ["./.opencode/plugins"] }
```

Injects the ruleset every turn at the active level; adds the `/ponytail` commands (see [Commands](README.md#commands)). OpenCode also auto-loads this repo's `AGENTS.md`, so the rules hold even without the plugin. The plugin adds the `lite/full/ultra/off` levels.

OpenCode 2 only. The `./` path resolves against your project's `opencode.json`; to share one checkout across projects, point it at the absolute path of the checkout's `.opencode/plugins` directory. A `plugins` entry must name a **directory**, not a file: OpenCode 2 rejects a path to `ponytail.mjs` with `configured plugin path must be a directory`. Opening this repo in OpenCode 2 needs no entry at all: it loads `.opencode/plugins/index.js` on its own.

Kilo Code is built on OpenCode and runs the same plugin through its `plugin` key: add `{ "plugin": ["@dietrichgebert/ponytail"] }` to `kilo.jsonc` (or `~/.config/kilo/kilo.jsonc` for every project).

OpenCode 1 uses the older `plugin` key: `{ "plugin": ["@dietrichgebert/ponytail"] }`, or from a checkout the file path: `{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }`.

## Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

Loads the ruleset as always-on context every session and registers the `/ponytail` commands; the `skills/` ship too, activated when a task needs them.
The Gemini adapter intentionally does not ship a root `hooks/hooks.json`: Gemini auto-loads that path, while Ponytail's lifecycle hooks use Claude/Codex event names.

Qwen Code installs the same extension: `qwen extensions install DietrichGebert/ponytail:ponytail`. It loads `AGENTS.md` as always-on context and registers the `/ponytail` commands and the skills; levels don't persist across sessions, since the lifecycle hooks are not used.

## Qoder

Qoder auto-loads `AGENTS.md` from the repo root as always-on context, so running ponytail from a checkout works with zero setup. For per-project rules, copy [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) into your project's `.qoder/rules/`. The six ponytail skills (`/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`) are available via Qoder's Skill system; the plugin manifest at [`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) points at the `skills/` directory.

For full plugin-tier support (automatic mode activation + ruleset injection on every prompt), install ponytail as a Qoder plugin (`qodercli plugins install <path-to-ponytail>`): the manifest loads [`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) and Qoder fills in `${QODER_PLUGIN_ROOT}`. Without the plugin, copy those hooks into your `.qoder/settings.json` and replace `${QODER_PLUGIN_ROOT}` with the path to your ponytail checkout. Qoder's `UserPromptSubmit` hook activates the default mode on first prompt and injects the ruleset every turn; `PreToolUse` with `task|Task` matcher injects the ruleset into subagents. Level switches (`/ponytail lite|full|ultra|off`) work automatically.

## Antigravity CLI

Google is renaming Gemini CLI to Antigravity CLI (the `agy` binary); the same extension installs there:

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

It reuses this repo's `gemini-extension.json`. One difference: Antigravity converts the `/ponytail` commands into skills, so you type them into the chat (e.g. `/ponytail-review` as a message) instead of picking them from a slash menu. Until the migration completes (around June 18, 2026), `gemini extensions install` still works too. To run it as an always-on rule instead, drop the ruleset into `.agents/rules/`.

## Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

Restart Hermes after installing. The plugin injects the active Ponytail mode before each LLM turn, registers the bundled skills as `ponytail:<skill>`, and adds `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, and `/ponytail-help`. In shared gateways, restrict `/ponytail` to trusted users with Hermes slash-command access controls; runtime mode is process-local.

## CodeWhale

Reads `AGENTS.md` from the project root, zero setup. Copy [`AGENTS.md`](AGENTS.md) to your project, or run `codewhale` from a checkout of this repo. That's it.

## Swival

Stage the collection in your library first, then add the skills you want:

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # stage into ~/.config/swival/library
swival skills add ponytail                                             # install the collection into this project
swival skills add --global ponytail                                    # or activate it in every project
```

Swival also reads `AGENTS.md` from the project root and `~/.config/swival/AGENTS.md` globally, the instruction-only fallback.

On the command line, use a `$` prefix with the plugin namespace to explicitly activate a skill. For example: `$ponytail:ponytail-review`.

## Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

Installs ponytail as a Devin plugin; skills are available as `/ponytail:ponytail`, `/ponytail:ponytail-review`, and so on.

## OpenClaw

```bash
clawhub install ponytail
```

Installs ponytail as an OpenClaw skill from ClawHub; the review, audit, debt, gain, and help skills install the same way (`clawhub install ponytail-review`, and so on). OpenClaw applies it on coding tasks and also exposes it as a `/ponytail` command. Without ClawHub, copy [`.openclaw/skills/ponytail`](.openclaw/skills/) into `~/.openclaw/skills/`.

## Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

Enable the plugin (off by default): `/plugins` → Plugins → Space on `ponytail`, or in `~/.grok/config.toml`:

```toml
[plugins]
enabled = ["ponytail"]
```

Start a new session (or reload plugins). Skills show as `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`. Verify with `grok inspect`. Grok can auto-invoke ponytail for coding tasks from its skill description; use `/ponytail` (or `/ponytail lite`, `/ponytail full`, `/ponytail ultra`) when activation needs to be explicit. Grok lifecycle hooks are not used because their SessionStart output cannot inject instructions.

`AGENTS.md` still works instruction-only from a checkout without the plugin.

## ZCode

ZCode loads Claude Code plugins. Open **Settings → Plugins**, choose **Create → Add marketplace**, enter `DietrichGebert/ponytail`, then install ponytail from the Personal tab. The ruleset arrives at session start and `/ponytail` level switches work, like in Claude Code (needs ponytail 4.10.3 or later and `node` on your PATH). ZCode has no `SubagentStart` event, so subagents run without the ruleset.

## Goose

```bash
goose plugin install https://github.com/DietrichGebert/ponytail.git
```

That imports the six skills as `ponytail:ponytail`, `ponytail:ponytail-review` and so on. For the always-on rules, copy [`AGENTS.md`](AGENTS.md) to `~/.agents/AGENTS.md` (or into your project; `~/.config/goose/.goosehints` works too). Goose has no lifecycle hooks, so the levels don't persist.

## Cursor

```bash
git clone https://github.com/DietrichGebert/ponytail
node ponytail/scripts/cursor-hooks.js install
```

Merges two native hooks into `~/.cursor/hooks.json` (add `--project` to write `<project>/.cursor/hooks.json` instead) and keeps any hooks you already have there. The entries run `node` from that checkout, so leave it where it is or re-run the install after moving it. Cursor reloads the file on save; open a new chat and the ruleset for your default level arrives through `sessionStart`. Send `/ponytail lite`, `/ponytail full`, `/ponytail ultra` or `/ponytail off` as a plain message to switch the level for the rest of the conversation; `/ponytail` reports it. Cursor's `subagentStart` cannot inject context, so subagents run without the ruleset, and cloud agents never fire `sessionStart`. The always-on rule (`.cursor/rules/ponytail.mdc`) and the hooks are alternatives: while the rule is in a workspace the hooks inject nothing and the mode commands answer with a notice, so delete the rule to let the hooks manage the level. Contract, verification record and limitations: [docs/cursor-hooks.md](docs/cursor-hooks.md). Uninstall: `node ponytail/scripts/cursor-hooks.js uninstall`.

## Settings

Set the level for every new session with the `PONYTAIL_DEFAULT_MODE` env var (`lite`/`full`/`ultra`/`off`), or a `defaultMode` field in `~/.config/ponytail/config.json` (`%APPDATA%\ponytail\config.json` on Windows). The default is `full`.

While active, the ruleset is also injected into every subagent spawned via the Agent tool. To scope that to specific agent types (say, keep it off read-only search agents), set the `PONYTAIL_SUBAGENT_MATCHER` env var to a regex tested against the subagent's `agent_type`. It is unanchored and case-insensitive: `explore|general` matches either, `^general$` is exact, and plugin agent types look like `plugin:name`. Unset means inject into every subagent (the default); an invalid regex, or a subagent whose type the platform doesn't report, also falls back to injecting.

## Other agents (rules file only)

Cursor (rule-only alternative to the [hooks install](#cursor)), Windsurf, Cline, GitHub Copilot Chat (the VS Code, JetBrains, and Visual Studio editor extension, not the standalone [Copilot CLI](#github-copilot-cli)), Aider, Kiro, Zed, CodeWhale, Swival, Qoder: copy the matching rules file from this repo ([`.cursor/rules/`](.cursor/rules/), [`.windsurf/rules/`](.windsurf/rules/), [`.clinerules/`](.clinerules/), [`.github/copilot-instructions.md`](.github/copilot-instructions.md), [`AGENTS.md`](AGENTS.md), [`.kiro/steering/`](.kiro/steering/), [`.qoder/rules/`](.qoder/rules/)).

Kiro: copy `.kiro/steering/ponytail.md` to `~/.kiro/steering/` (global) or `.kiro/steering/` in your project.

GitHub Copilot CLI fallback (instruction-only mode): it reads `AGENTS.md` and `.github/copilot-instructions.md` in a project, or copy the rules into `~/.copilot/copilot-instructions.md` to run ponytail in every project. This path keeps always-on guidance, but does not add plugin mode switches or hooks.

VS Code with the Codex extension reads `AGENTS.md`, which this repo ships, so it works from the repo root with no setup (`~/.codex/AGENTS.md` makes Codex global).

JetBrains Junie can read `AGENTS.md` once you point it there in Settings → Tools → Junie → Project Settings → Guidelines Path (it is not automatic yet). This repo ships `AGENTS.md`; `.junie/guidelines.md` is Junie's legacy path.

Amp (Sourcegraph) reads `AGENTS.md` from the working directory and parent directories up to `$HOME`, which this repo ships, so it works with no setup (`~/.config/amp/AGENTS.md` works globally).

Jules (Google) reads `AGENTS.md` from the repository root, which this repo ships, so it picks up the ruleset with no setup.

## Uninstall

| Host | Command |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Grok Build | `grok plugin uninstall ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Oh My Pi (omp) | `omp plugin uninstall ponytail@ponytail`, then `omp plugin marketplace remove ponytail` |
| Cursor hooks | `node scripts/cursor-hooks.js uninstall` (add `--project` for a project-level install); removes only ponytail's entries from `hooks.json` |
| Cursor rule / Windsurf / Cline / Qoder / etc. | Delete the copied rule file |

These remove the plugin's own files. They leave behind a small amount of state ponytail writes outside the plugin folder: the mode flag (`~/.claude/.ponytail-active`, or `~/.cursor/.ponytail-active` for Cursor), `~/.config/ponytail/config.json`, ponytail's entries in `~/.cursor/hooks.json`, and (if you accepted the setup nudge) a `statusLine` entry in `~/.claude/settings.json`. Run `node scripts/uninstall.js` to clean those up too. **Run it before the host remove command above**: the script is itself a plugin file, so removing the plugin first deletes it (or run it from a separate clone of this repo). It only removes the statusLine entry if it points at ponytail's own script, so a statusline you set up yourself is left untouched.
