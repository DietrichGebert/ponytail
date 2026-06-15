# ponytail-opencode-plugin

Lazy senior dev mode for [OpenCode](https://opencode.ai). Companion for `@tarquinen/opencode-dcp`.

## Install

```
opencode plugin add ponytail-opencode-plugin@latest
```

Or in `opencode.json`:

```json
{
  "plugin": ["ponytail-opencode-plugin@latest"]
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/ponytail` | Show current mode |
| `/ponytail lite` | Lite mode — build what's asked, name lazier alternative |
| `/ponytail full` | Full mode — ladder enforced, stdlib first, shortest diff (default) |
| `/ponytail ultra` | Ultra mode — YAGNI extremist, deletion before addition |
| `/ponytail off` | Disable |
| `/ponytail-review` | Over-engineering review |

## Config

Optional `ponytail.json` in project root or `~/.config/opencode/ponytail.json`:

```json
{
  "enabled": true,
  "defaultMode": "full",
  "features": {
    "ponytail": true,
    "review": true
  }
}
```

## What it does

Injects ponytail rules into every LLM turn:

1. Does this need to exist at all? (YAGNI)
2. Stdlib does it? Use it.
3. Native platform feature? Use it.
4. Already-installed dependency? Use it.
5. One line? One line.
6. Only then: minimum code that works.

Skipped: unrequested abstractions, avoidable deps, boilerplate, speculative features.

## License

MIT
