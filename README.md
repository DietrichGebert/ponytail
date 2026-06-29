# Graybeard

Stack-aware senior dev mode for AI agents.

Graybeard is a fork of Ponytail's multi-agent plugin shell with a different
job: push the agent toward the best stack-native implementation, not merely the
shortest one.

It keeps the good senior-engineering parts of Ponytail: YAGNI, minimalism,
code-review judgment, and productivity. The difference is that Graybeard treats
those as tools inside a broader stack-aware quality bar, not as permission to
skip proof or durable design.

## What It Does

Before coding or advising, Graybeard tells the agent to:

1. read repo instructions, manifests, touched files, callers, and tests
2. identify the actual stack and framework conventions
3. reuse local patterns and durable constraints
4. avoid speculative abstractions and dependencies
5. require focused automated proof for behavior, data, auth, integrations, and UI flows

The lifecycle hooks add a short detected-stack hint from common manifests such
as `package.json`, `Gemfile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, and
`Package.swift`. The hint is not authority; the agent still has to verify
against the repo.

## Modes

| Command | Behavior |
|---------|----------|
| `/graybeard advisory` | Recommend the stack-native path and name tradeoffs. |
| `/graybeard` or `/graybeard balanced` | Default. Choose the stack-native implementation and require focused proof. |
| `/graybeard strict` | Challenge weak requirements, missing tests, unsafe boundaries, and non-standard patterns. |
| `/graybeard off` | Stop injecting Graybeard guidance. |

Commands:

- `/graybeard-review` - review current changes for stack fit, risks, and missing proof
- `/graybeard-audit` - audit a repo for stack-practice and maintainability risks
- `/graybeard-help` - quick reference

Set the default mode with `GRAYBEARD_DEFAULT_MODE` or
`~/.config/graybeard/config.json`:

```json
{ "defaultMode": "balanced" }
```

## Install

Claude Code:

```text
/plugin marketplace add allanmongej/graybeard
/plugin install graybeard@graybeard
```

Codex:

```bash
codex plugin marketplace add allanmongej/graybeard
codex
```

Open `/plugins`, select the Graybeard marketplace, install Graybeard, then
open `/hooks` and trust its lifecycle hooks.

OpenCode:

```json
{ "plugin": ["@allanmongej/graybeard"] }
```

Local checkout:

```json
{ "plugin": ["./.opencode/plugins/graybeard.mjs"] }
```

Gemini CLI:

```bash
gemini extensions install https://github.com/allanmongej/graybeard
```

Pi:

```bash
pi install git:github.com/allanmongej/graybeard
```

Hermes:

```bash
hermes plugins install allanmongej/graybeard --enable
```

## Development

Run:

```bash
node scripts/check-rule-copies.js
node scripts/check-versions.js
npm test
```

The repo keeps Ponytail's MIT license and plugin distribution machinery. The
Graybeard rules, commands, and docs are intentionally separate from Ponytail's
benchmark claims.
