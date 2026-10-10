---
name: crewcut-help
description: >
  Quick reference for crewcut levels, skills and commands. One-shot display.
  Use for /crewcut-help, "crewcut help", "how do I use crewcut".
---

# Crewcut Help

Display this reference card when invoked. One-shot, do NOT change mode,
write flag files, or persist anything.

## Levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **Lite** | `/crewcut lite` | Build what was asked, name the smaller option in one line. |
| **Full** | `/crewcut` | The smallest complete change, a check where the logic needs one, and a reply that names what was skipped and any risk. Default. |
| **Ultra** | `/crewcut ultra` | Also questions the request and pushes back before building. |

Level sticks until changed or session end.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **crewcut** | `/crewcut` | The mode itself: least new code, proper OO structure, clear replies that name skipped work and risks. |
| **crewcut-review** | `/crewcut-review` | Quality review of a diff: bugs, security, load, missing tests, speed, what to cut. Each finding says what goes wrong and how to fix it. |
| **crewcut-audit** | `/crewcut-audit` | The same quality review for the whole repo, ranked. |
| **crewcut-debt** | `/crewcut-debt` | Harvest `shortcut:` comments into a tracked ledger. |
| **crewcut-help** | `/crewcut-help` | This card. |

In Copilot CLI, commands are namespaced: `/crewcut:crewcut`, `/crewcut:crewcut-review`.

## Deactivate

Say "stop crewcut" or "normal mode". Resume anytime with `/crewcut`.
`/crewcut off` also works.

## Configure Default Mode

Default mode = `full`, auto-active every session. Change it:

**Environment variable** (highest priority):
```bash
export CREWCUT_DEFAULT_MODE=ultra
```

**Config file** (`~/.config/crewcut/config.json`, Windows: `%APPDATA%\crewcut\config.json`):
```json
{ "defaultMode": "lite" }
```

Set `"off"` to disable auto-activation on session start, activate manually
with `/crewcut` when wanted.

Resolution: env var > config file > `full`.

## Update

Enable auto-update once: open `/plugin`, go to Marketplaces, pick crewcut, Enable auto-update. Claude Code then pulls new versions at startup (run `/reload-plugins` when it prompts). Manual refresh: `/plugin marketplace update crewcut` then `/reload-plugins`.

If `/plugin` is not recognized, your Claude Code is out of date. Update it (`npm install -g @anthropic-ai/claude-code@latest`, or `brew upgrade claude-code`) and restart. Other hosts use their own update flow.

## More

Full docs + examples: https://github.com/HermitOS/crewcut
