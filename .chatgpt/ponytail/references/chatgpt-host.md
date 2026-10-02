# ChatGPT host behavior

Use this reference as the authority for ChatGPT-specific installation, commands, mode state, updates, and removal. Do not reuse host behavior from Claude Code, Codex, OpenCode, Copilot CLI, or other adapters.

## Use

ChatGPT can select Ponytail automatically for coding requests. Users can also type these text triggers:

- `ponytail lite`, `ponytail full`, `ponytail ultra`, or `ponytail off`
- `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, or `/ponytail-help`
- `stop ponytail` or `normal mode`

Slash-like forms are messages, not registered ChatGPT slash-menu commands.

## State

Mode is scoped to the current conversation. Default to full when Ponytail is first used unless the user explicitly selects another level. Do not read or create `PONYTAIL_DEFAULT_MODE`, `~/.config/ponytail/config.json`, mode flags, statusline files, or lifecycle hooks.

## Install and update

The upload bundle is a ZIP whose top-level directory is `ponytail/`. In ChatGPT, the user opens **Plugins → Skills → Create → Upload from your computer** and selects the ZIP. Availability and admin controls depend on the user's current ChatGPT plan and workspace settings.

To update, the user builds a newer ZIP and replaces or re-uploads the Skill. Personal Skills may need to be added separately on different ChatGPT surfaces.

## Remove

Delete the uploaded Ponytail Skill from **Plugins → Skills**. No local Ponytail state needs cleanup because this adapter writes none.
