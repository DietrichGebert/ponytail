# Agent Portability

Ponytail is an agent-portable skill distribution. The skills in `skills/` hold
the core behavior; host-specific files are adapters that make that behavior easy
to load in a given agent.

## Supported Adapters

| Host | Files | Notes |
|------|-------|-------|
| Claude Code | `.claude-plugin/`, `commands/`, `hooks/` | Full plugin install with session activation, mode tracking, commands, and statusline support. |
| Codex | `.codex-plugin/plugin.json`, `hooks/hooks.json`, `hooks/`, `skills/` | Plugin install with the same skills plus lifecycle hooks for activation and mode tracking. |
| OpenCode | `.opencode/plugins/ponytail.mjs`, `.opencode/command/`, `hooks/`, `skills/` | Server plugin injects the ruleset each turn via `experimental.chat.system.transform` and persists `/ponytail` switches; reuses the shared instruction builder. |
| Cursor | `.cursor/rules/ponytail.mdc` | Always-on project rule. |
| Windsurf | `.windsurf/rules/ponytail.md` | Project rule. |
| Cline | `.clinerules/ponytail.md` | Project rule. |
| GitHub Copilot | `.github/copilot-instructions.md` | Repository instruction file. |
| Kiro | `.kiro/steering/ponytail.md` | Steering rule; copy globally or into a project. |
| Generic agents | `AGENTS.md` or `skills/*/SKILL.md` | Copy the compact rule file or load the skill files directly. |

## Adapter Rule

Keep adapters thin. When a host supports skills or hooks, point it at the
existing `skills/` and `hooks/` files. When a host only supports project
instructions, keep its copied rule text aligned with `AGENTS.md`.

## Portable Behavior

- `skills/ponytail/SKILL.md`: lazy senior dev mode
- `skills/ponytail-review/SKILL.md`: over-engineering review
- `skills/ponytail-help/SKILL.md`: quick reference
- `AGENTS.md`: compact always-on instruction set for agents without skill support
