---
name: graybeard-help
description: "Quick reference for graybeard's modes, skills, and commands. One-shot display."
homepage: https://github.com/allanmongej/graybeard
license: MIT
---

# Graybeard Help

## Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| advisory | `/graybeard advisory` | Recommend the stack-native path and name tradeoffs. |
| balanced | `/graybeard` | Default. Choose the stack-native implementation and require focused proof. |
| strict | `/graybeard strict` | Challenge weak requirements, missing tests, unsafe boundaries, and non-standard patterns. |
| off | `/graybeard off` | Stop injecting Graybeard guidance. |

## Commands

| Command | What it does |
|---------|--------------|
| `/graybeard` | Set or report the active mode. |
| `/graybeard-review` | Review current changes for stack fit, risks, and missing proof. |
| `/graybeard-audit` | Audit a repo for stack-practice and maintainability risks. |
| `/graybeard-help` | Show this card. |

Default mode is `balanced`. Configure it with `GRAYBEARD_DEFAULT_MODE` or
`~/.config/graybeard/config.json` containing `{"defaultMode":"balanced"}`.
