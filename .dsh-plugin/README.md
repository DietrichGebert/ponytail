# Ponytail for DeepSeek Harness

A Cordis bundle that mounts ponytail natively. It reads this repo's own `skills/` and `hooks/`, so
there is no vendored copy to drift.

| Surface | How it works |
|---|---|
| `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help` | The skills themselves. Harness turns a registered skill into a native `/name` invocation, so these need no command rows. |
| `/ponytail` | The one host command: `/ponytail lite\|full\|ultra\|off`, or no argument to report the current level. |
| Always-on ruleset | A per-session system-prompt section carrying the level-filtered ruleset, installed at `agent/created` and for sessions already open when the bundle activates. |

`/ponytail` is a command rather than a skill because Harness resolves a host command before a skill
of the same name: registering all six as commands would shadow five of them. The ruleset is already
injected, so a `/ponytail` *skill* invocation would be redundant anyway.

`off` **disposes** the section registration instead of returning empty text, because
`systemPrompt.assemble()` keeps sections whose text renders empty — blanking it would leave the
section in every assembly while looking inert.

## Install

```bash
dsh plugin --profile <profile> add <path-to-ponytail>/.dsh-plugin
```

Nothing in the Harness application is touched: the bundle lives in the profile and every
registration is a Cordis effect owned by the plugin's fiber, so removal is clean.

## Configure

Override the row in the profile's `cordis.patch.yml` (your layer survives upgrades):

```yaml
- id: ponytail
  config:
    defaultMode: lite        # lite | full | ultra | off
    logPath: /custom/path    # default: $DSH_HOME/logs/ponytail.log
```

Without an explicit `defaultMode`, the repo's own resolution order applies:
`PONYTAIL_DEFAULT_MODE`, then `~/.config/ponytail/config.json`, then `full`.

Levels are per session. Nothing is appended to the session log and no new event types are written.

## Uninstall

```bash
dsh plugin --profile <profile> remove ponytail-dsh
```

## Tests

`tests/dsh-plugin.test.js` runs with the rest of the suite (`npm test`). It holds the two failure
modes that are silent in production: an agent-scope registration that survives uninstall and keeps
injecting the ruleset, and an `off` that reports a level without disposing the section.
