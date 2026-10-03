# Agent Portability

Ponytail is an agent-portable skill distribution. The skills in `skills/` hold
the core behavior; host-specific files are adapters that make that behavior easy
to load in a given agent.

## Supported Adapters

| Host | Files | Notes |
|------|-------|-------|
| Claude Code | `.claude-plugin/plugin.json`, `commands/`, `hooks/claude-codex-hooks.json`, `hooks/` | Full plugin install with session activation, mode tracking, commands, and statusline support. |
| Codex | npm package: `.codex-plugin/plugin.json`, `hooks/claude-codex-hooks.json`, `hooks/`, `skills/`, `assets/` | The Codex marketplace installs the published npm adapter with lifecycle hooks for activation, mode tracking, and subagent context. |
| Grok Build | root `plugin.json`, `.grok-plugin/marketplace.json`, `skills/`, `commands/` | `grok plugin install DietrichGebert/ponytail --trust`, then enable. Grok can auto-invoke ponytail from its coding-task skill description; `/ponytail` makes activation explicit. Grok lifecycle hooks are not used because passive hook output cannot inject instructions. |
| OpenCode | `.opencode/plugins/ponytail.mjs`, `.opencode/command/`, `hooks/`, `skills/` | Server plugin injects the ruleset each turn via `experimental.chat.system.transform` and persists `/ponytail` switches; reuses the shared instruction builder. |
| pi | `pi-extension/`, `skills/`, `hooks/` | Package extension: injects the ruleset each turn through the shared instruction builder and registers the `/ponytail` commands. |
| Hermes Agent | `plugin.yaml`, `__init__.py`, `skills/` | Native Hermes plugin: injects active mode through `pre_llm_call`, rewrites gateway `/ponytail-*` skill commands into agent prompts, registers `/ponytail` mode switching, and exposes bundled skills as `ponytail:<skill>`. |
| Gemini CLI | `gemini-extension.json`, `AGENTS.md`, `commands/`, `skills/` | Extension manifest points `contextFileName` at `AGENTS.md` for always-on rules, and reuses the existing `commands/*.toml` and `skills/`, which Gemini CLI auto-discovers. The Claude/Codex hook map is not placed at Gemini's auto-discovered `hooks/hooks.json` path. |
| Cursor | `hooks/cursor-hooks.json`, `scripts/cursor-hooks.js`, `hooks/`, `.cursor/rules/ponytail.mdc` | Native hooks: `node scripts/cursor-hooks.js install` merges `sessionStart` (default-level ruleset via `additional_context`) and `beforeSubmitPrompt` (`/ponytail` level tracking, new-level ruleset via `additional_context`) into `~/.cursor/hooks.json`, or `.cursor/hooks.json` with `--project`, keeping unrelated hooks. No subagent injection (Cursor's `subagentStart` takes only `permission`/`user_message`) and no `sessionStart` in cloud agents. `.cursor/rules/ponytail.mdc` stays the instruction-only alternative; while that rule is in a workspace the hooks inject only a notice. Contract and verification record: [cursor-hooks.md](cursor-hooks.md). |
| Windsurf | `.windsurf/rules/ponytail.md` | Project rule. |
| Cline | `.clinerules/ponytail.md` | Project rule. |
| GitHub Copilot | `.github/copilot-instructions.md` | Repository instruction file. |
| GitHub Copilot CLI | `.github/plugin/`, `AGENTS.md`, `.github/copilot-instructions.md`, `~/.copilot/copilot-instructions.md` | Plugin-supported (`copilot plugin marketplace add DietrichGebert/ponytail` + `copilot plugin install ponytail@ponytail`). Fallback instruction mode remains: per-project from `AGENTS.md` or `.github/copilot-instructions.md`, or globally from `~/.copilot/copilot-instructions.md` (instruction-tier, no `/ponytail` levels or hooks). |
| Antigravity | `AGENTS.md` | Reads `AGENTS.md` at the repo root as always-on rules (like `.cursorrules`/`CLAUDE.md`); `.agents/rules/` also works for workspace rules. Instruction-tier. |
| CodeWhale | `AGENTS.md` | Reads `AGENTS.md` from the repo root as project instructions; also reads `CLAUDE.md` and `.claude/instructions.md` as fallbacks. Instruction-tier. |
| Swival | `.swival/skills/`, `AGENTS.md` | `swival skills add https://github.com/DietrichGebert/ponytail` installs the six skills straight into `.swival/skills/`. Add `--global` to stage them in the library (`~/.config/swival/library`) first, then `swival skills add ponytail` (or `--global ponytail`) to activate per-project or everywhere. Also reads `AGENTS.md` from the repo root and `~/.config/swival/AGENTS.md` globally as instruction-tier fallback. |
| VS Code + Codex extension | `AGENTS.md` | The Codex extension reads `AGENTS.md` (repo root, or `~/.codex/AGENTS.md` globally). Instruction-tier; the full Codex plugin row above adds `/ponytail` levels and hooks. |
| JetBrains Junie | `AGENTS.md` | Junie reads `AGENTS.md` once you point it there in Settings → Tools → Junie → Project Settings → Guidelines Path (not automatic yet); this repo ships `AGENTS.md`, and `.junie/guidelines.md` is Junie's legacy path. Instruction-tier. |
| Amp (Sourcegraph) | `AGENTS.md` | Amp reads `AGENTS.md` from the working directory and parent directories up to `$HOME` (plus global config like `~/.config/amp/AGENTS.md`); falls back to `AGENT.md`/`CLAUDE.md`. Instruction-tier. |
| Factory Droid | `AGENTS.md`, `skills/` | Droid reads `AGENTS.md` from the working directory up to the git root (also inside `.factory/` and `.agents/` there) and globally from `~/.factory/AGENTS.md`. It loads `SKILL.md` skills from `.factory/skills/` or `~/.factory/skills/`, so copy the folders from `skills/` there for review, audit and the other skills. Instruction-tier, no `/ponytail` levels or hooks. |
| Command Code | `skills/`, `AGENTS.md` | `cmd skills add https://github.com/DietrichGebert/ponytail` installs the six skills into `.commandcode/skills/` (add `--global` for `~/.commandcode/skills/`); `.agents/skills/` is auto-discovered too. Reads `AGENTS.md` as project memory every session. Instruction-tier, no `/ponytail` levels or hooks. |
| Jules (Google) | `AGENTS.md` | Jules automatically reads `AGENTS.md` from the repository root. Instruction-tier. |
| Kiro | `.kiro/steering/ponytail.md` | Steering rule; copy globally or into a project. |
| Qoder | `.qoder/rules/ponytail.md`, `.qoder-plugin/plugin.json`, `hooks/qoder-hooks.json`, `skills/`, `AGENTS.md` | Qoder auto-loads `AGENTS.md` as always-on context; `.qoder/rules/ponytail.md` provides per-project rules; the plugin manifest points at `skills/` for the six ponytail skills (invoked as `/ponytail`, `/ponytail-review`, etc. via the Skill system). Full plugin-tier: `hooks/qoder-hooks.json` template registers `UserPromptSubmit` (mode activation + ruleset injection) and `PreToolUse` with `task|Task` matcher (subagent injection). Instruction-tier works from repo root with zero setup via `AGENTS.md`. |
| Zed | `AGENTS.md` | Auto-includes `AGENTS.md` from the worktree root as one of its default rule files for the Agent Panel. Instruction-tier. |
| Generic agents | `AGENTS.md` or `skills/*/SKILL.md` | Copy the compact rule file or load the skill files directly. |

## Adapter Rule

### Codex distribution

The repository keeps its Agent Plugins 1.0.0 root `plugin.json` for portable
clients. Codex 0.160.0 recognizes that format but explicitly skips its lifecycle
hooks, including hooks declared in `extensions.com.openai` or the compatibility
overlay. Installing the Git root therefore exposes skills without any hooks.

The Codex marketplace in `.agents/plugins/marketplace.json` instead installs
`@dietrichgebert/ponytail` from npm. The package's `files` allowlist includes
the existing Codex compatibility manifest and its runtime files, but not the
portable root manifest. Codex consequently loads the compatibility adapter;
the portable Git distribution and other host adapters stay intact.

Publish an npm release containing `.codex-plugin/` before rolling out this
marketplace source: older published packages do not contain the adapter.
The source requires `>=4.10.4`, so Codex reports an unavailable release instead
of silently installing the hookless 4.10.3 package before that publication.
Existing Git installs need the updated marketplace and a reinstall, followed
by `/hooks` trust review if the installed hook definitions changed. Never
edit the plugin cache or pre-populate trust hashes as part of installation.

`tests/package.test.js` checks the actual `npm pack` inventory, the marketplace
source, hook dependencies, skills, and interface assets. It also guards against
accidentally packaging a portable root manifest over the Codex adapter.

### Shared behavior

Keep adapters thin. When a host supports skills or hooks, point it at the
existing `skills/` and `hooks/` files. When a host only supports project
instructions, keep its copied rule text aligned with `AGENTS.md`.

## Portable Behavior

- `skills/ponytail/SKILL.md`: lazy senior dev mode
- `skills/ponytail-review/SKILL.md`: over-engineering review
- `skills/ponytail-audit/SKILL.md`: whole-repo over-engineering audit
- `skills/ponytail-debt/SKILL.md`: harvest `ponytail:` shortcuts into a tracked ledger
- `skills/ponytail-gain/SKILL.md`: measured-impact scoreboard from the benchmark
- `skills/ponytail-help/SKILL.md`: quick reference
- `AGENTS.md`: compact always-on instruction set for agents without skill support
