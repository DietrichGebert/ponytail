# Agent Portability

Ponytail is an agent-portable skill distribution. The skills in `skills/` hold
the core behavior; host-specific files are adapters that make that behavior easy
to load in a given agent.

## Supported Adapters

| Host | Files | Notes |
|------|-------|-------|
| Claude Code | `.claude-plugin/plugin.json`, `commands/`, `hooks/claude-codex-hooks.json`, `hooks/` | Full plugin install with session activation, mode tracking, commands, and statusline support. |
| Codex | `.codex-plugin/plugin.json`, `hooks/claude-codex-hooks.json`, `hooks/`, `skills/` | Plugin install with the same skills plus lifecycle hooks for activation and mode tracking. |
| Grok Build | root `plugin.json`, `.grok-plugin/marketplace.json`, `skills/`, `commands/` | `grok plugin install DietrichGebert/ponytail --trust`, then enable. Grok can auto-invoke ponytail from its coding-task skill description; `/ponytail` makes activation explicit. Grok lifecycle hooks are not used because passive hook output cannot inject instructions. |
| OpenCode | `.opencode/plugins/ponytail.mjs`, `.opencode/command/`, `hooks/`, `skills/` | Server plugin injects the ruleset each turn via `experimental.chat.system.transform` and persists `/ponytail` switches; reuses the shared instruction builder. |
| pi | `pi-extension/`, `skills/`, `hooks/` | Package extension: injects the ruleset each turn through the shared instruction builder and registers the `/ponytail` commands. |
| Oh My Pi (OMP) | `omp-extension/`, `pi-extension/index.js` (shared parser only), `skills/`, `hooks/` | Native OMP extension with branch-scoped session state, string-array system policy, and active-skill expansion. The Pi extension is not registered in OMP. |
| Hermes Agent | `plugin.yaml`, `__init__.py`, `skills/` | Native Hermes plugin: injects active mode through `pre_llm_call`, rewrites gateway `/ponytail-*` skill commands into agent prompts, registers `/ponytail` mode switching, and exposes bundled skills as `ponytail:<skill>`. |
| Gemini CLI | `gemini-extension.json`, `AGENTS.md`, `commands/`, `skills/` | Extension manifest points `contextFileName` at `AGENTS.md` for always-on rules, and reuses the existing `commands/*.toml` and `skills/`, which Gemini CLI auto-discovers. The Claude/Codex hook map is not placed at Gemini's auto-discovered `hooks/hooks.json` path. |
| Cursor | `.cursor/rules/ponytail.mdc` | Always-on project rule. |
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
| Jules (Google) | `AGENTS.md` | Jules automatically reads `AGENTS.md` from the repository root. Instruction-tier. |
| Kiro | `.kiro/steering/ponytail.md` | Steering rule; copy globally or into a project. |
| Qoder | `.qoder/rules/ponytail.md`, `.qoder-plugin/plugin.json`, `hooks/qoder-hooks.json`, `skills/`, `AGENTS.md` | Qoder auto-loads `AGENTS.md` as always-on context; `.qoder/rules/ponytail.md` provides per-project rules; the plugin manifest points at `skills/` for the six ponytail skills (invoked as `/ponytail`, `/ponytail-review`, etc. via the Skill system). Full plugin-tier: `hooks/qoder-hooks.json` template registers `UserPromptSubmit` (mode activation + ruleset injection) and `PreToolUse` with `task|Task` matcher (subagent injection). Instruction-tier works from repo root with zero setup via `AGENTS.md`. |
| Zed | `AGENTS.md` | Auto-includes `AGENTS.md` from the worktree root as one of its default rule files for the Agent Panel. Instruction-tier. |
| Generic agents | `AGENTS.md` or `skills/*/SKILL.md` | Copy the compact rule file or load the skill files directly. |

## Adapter Rule

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

## OMP Development and Compatibility

The OMP entry reuses `hooks/ponytail-config.js`,
`hooks/ponytail-instructions.js`, and the exported command parser from
`pi-extension/index.js`. It does not register the Pi extension or duplicate any
skill body. Policy modules load directly from the installed package; there is
no marketplace root lookup or asynchronous policy cache. Missing modules fail
through OMP's extension loader. Skill files are read on each alias invocation,
so a missing or unreadable skill reports an error and can be retried after repair.

Required native APIs are `before_agent_start.systemPrompt: string[]`,
`sessionManager.getBranch()`, the session switch/tree/branch/compact events,
and `getActiveSkills` / `buildSkillPromptMessage` from
`@oh-my-pi/pi-coding-agent/extensibility/skills`. Aliases use user-invocation
provenance and send the resulting prompt, not literal `/skill:` text.

The host must dispatch external input before executing or queuing it, and run
startup policy once per new user run, including promoted queues. The integration
target is OMP commit `6aef0e8ad51b3bc5ea7a5f2a255c3d48e4c5af72`
(containing fix `ad3fb437d3`). Its version string is `18.1.17`; that string alone
does not establish that a published build has these lifecycle fixes. The
adapter deliberately does not replay input or refresh policy per provider request.

Project-local skill aliases respect `ctx.isProjectTrusted()` when the host
reports false. The target OMP implementation always returns true: this is a
compatibility check, **not** an OMP sandbox or security boundary.

Run the focused regressions with Bun and the target OMP coding-agent package
available to module resolution:

```bash
bun run test:omp
```

For an OMP source checkout with its workspace dependencies already installed,
link its package scope into this checkout if `node_modules/@oh-my-pi` does not
already exist (`NODE_PATH` alone does not resolve Bun's package subpath imports):

```bash
mkdir -p node_modules
ln -s /absolute/path/to/oh-my-pi/node_modules/@oh-my-pi node_modules/@oh-my-pi
bun run test:omp
```

The suite uses OMP's real in-memory session manager and skill prompt builder.
It exercises user stop phrases, branch/session restoration, defaults, system
block ownership, all five idle/busy aliases, source provenance, and recoverable
skill read errors. Config changes and skill overrides are isolated and restored
by the tests. Run the existing `npm test` separately to cover Pi and the other
adapters, and use `npm pack --dry-run` to inspect the distributed assets.
