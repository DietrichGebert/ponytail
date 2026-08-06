# ChatGPT Skill Adapter

Ponytail ships a ChatGPT-specific adapter in `.chatgpt/ponytail/`. It follows the Agent Skills directory format while exposing the six canonical Ponytail behaviors through one uploaded Skill.

## Build and package

From the repository root:

```bash
npm run pack:chatgpt
```

This regenerates the adapter from `skills/` and writes:

```text
dist/ponytail-chatgpt-skill.zip
```

Build without creating an archive:

```bash
npm run build:chatgpt
```

The packaging command uses Python 3's standard-library `zipfile` module. It tries `python3`, `python`, and Windows' `py -3` launcher, in that order.

## Install in ChatGPT

1. Open **Plugins** in the ChatGPT sidebar.
2. Open **Skills**.
3. Choose **Create**, then **Upload from your computer**.
4. Select `dist/ponytail-chatgpt-skill.zip`.

ChatGPT availability and workspace controls can change. See [OpenAI's Skills in ChatGPT documentation](https://help.openai.com/en/articles/20001066-skills-in-chatgpt) for the current plans, admin settings, and upload UI.

## Use

ChatGPT can select Ponytail automatically for coding requests. Explicit text triggers also work:

```text
ponytail full
ponytail ultra
/ponytail-review
/ponytail-audit
/ponytail-debt
/ponytail-gain
/ponytail-help
stop ponytail
```

The slash-like forms above are messages, not registered slash-menu commands.

The uploaded Skill provides:

- the core minimal-implementation ladder
- diff-focused over-engineering review
- repository-wide complexity audit
- `ponytail:` deferred-debt collection
- the published benchmark scoreboard
- Ponytail usage and mode help

## ChatGPT host semantics

ChatGPT differs from plugin hosts such as Claude Code, Codex, OpenCode, and Copilot CLI:

- mode is scoped to the current conversation
- no lifecycle hooks run on session start or prompt submission
- no statusline or local mode flag is created
- `PONYTAIL_DEFAULT_MODE` and `~/.config/ponytail/config.json` do not configure the uploaded Skill
- commands are natural-language or slash-like text triggers, not host-registered commands
- the six canonical skills are routed through one root `SKILL.md`, because one upload should expose one Ponytail Skill

To update Ponytail, build a fresh ZIP from the newer checkout and replace or re-upload the Skill in ChatGPT. To remove it, delete the uploaded Skill from **Plugins → Skills**. Personal Skills may need to be added separately on different ChatGPT surfaces; consult the current OpenAI documentation above.

## Layout

```text
.chatgpt/ponytail/
├── SKILL.md
├── agents/openai.yaml
└── references/
    ├── chatgpt-host.md
    ├── ponytail.md
    ├── ponytail-review.md
    ├── ponytail-audit.md
    ├── ponytail-debt.md
    ├── ponytail-gain.md
    └── ponytail-help.md
```

`SKILL.md` is the only Skill entrypoint. The six `ponytail*.md` references are generated from the bodies of the canonical `skills/*/SKILL.md` files. `chatgpt-host.md` contains the host-specific behavior that must not be inherited from Claude, Codex, or other adapters.

## Maintenance

After changing a canonical skill:

```bash
npm run build:chatgpt
node --test tests/chatgpt-skill.test.js
```

The tests fail when generated references drift, when another nested `SKILL.md` appears, when host-specific instructions leak into ChatGPT help, or when packaging no longer produces a single-entrypoint ZIP.
