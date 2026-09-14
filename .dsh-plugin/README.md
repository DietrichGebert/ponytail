# dsh-plugin-ponytail

[Ponytail](https://github.com/DietrichGebert/ponytail) — lazy senior dev mode —
packaged as a native [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)
plugin: six skills plus six slash commands, zero runtime dependencies.

> He says nothing. He writes one line. It works.

## Install

```sh
# from a checkout of the repo, linked live:
dsh plugin --profile web add /absolute/path/to/ponytail/.dsh-plugin

# or once published to npm:
dsh plugin --profile web add dsh-plugin-ponytail
```

Then restart `dsh web`.

## What you get

- Six skills: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`,
  `ponytail-gain`, `ponytail-help` (see each `SKILL.md`).
- Six matching slash commands: `/ponytail [lite|full|ultra|off]`,
  `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`,
  `/ponytail-help`.

## Layout

- `cordis.patch.yml` mounts `lib/index.mjs` into the DSH loader.
- `lib/index.mjs` — zero-dependency Cordis plugin: registers the six commands
  on `ctx.commands` and a skill provider on `ctx.skills`. Each command steers
  the agent with its briefing as a user message, since a command result is
  rendered in the UI and never enters model history.

The skills are the repo-root `skills/*/SKILL.md` — not duplicated here. In a
checkout (or a path-based `dsh plugin add`) the provider reads them directly,
so this adapter references the same single source of truth the other hosts
do. `skills/` exists only in the published npm tarball (npm cannot include
files outside the package dir): it is regenerated from `../skills` by
`scripts/sync-skills.mjs`, which runs automatically on `npm pack`/`publish`
(prepack) and is byte-checked by `tests/dsh-plugin.test.js`.

## Marketplace

DSH indexes plugins from GitHub repos with the `dsh-plugin` topic. Before
releasing, bump the version together with the repo release
(`scripts/check-versions.js` guards it), then `npm publish` from this
directory — the prepack hook refreshes `skills/` automatically.

## License

MIT © Dietrich Gebert
