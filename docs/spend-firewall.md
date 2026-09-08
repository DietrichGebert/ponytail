# Spend firewall

Ponytail's job is to stop an agent over-building. The spend firewall is the
same instinct pointed at the bill: a per-session budget, metered from real token
usage, that warns before you hit it and stops the session at it.

It exists because the expensive failure isn't a long session — it's a loop. An
agent that retries a failing build forty times spends forty times the money
without ever telling you, and the first you hear of it is the invoice.

**It is off unless you set a limit.** Nothing changes on upgrade.

## Turn it on

```
/ponytail spend limit 5
```

Five dollars per session. You get a warning at 75%, and the session stops at
$5.00.

Or without the command:

```bash
export PONYTAIL_SPEND_LIMIT=5
```

## Commands

| Command | What it does |
|---------|--------------|
| `/ponytail spend` | Report: spent, budget, percentage, tokens. Works with no limit set — just the meter. |
| `/ponytail spend limit <usd>` | Set the per-session budget. Saved to config, so it applies to new sessions too. |
| `/ponytail spend reset` | Zero this session's counter. The way out of a block when the work is legitimately worth more. |
| `/ponytail spend warn` | Warn at the threshold and past the limit, never block. |
| `/ponytail spend block` | Warn at the threshold, block at the limit. The default. |
| `/ponytail spend off` | Stop warning and blocking. Metering continues, so `/ponytail spend` still reports. |

These stay reachable from inside a blocked session — otherwise the only way out
of a bad limit would be restarting the agent.

## The two checkpoints

The firewall runs at two points, because a runaway burns money at two rates:

| Event | Catches | Effect |
|-------|---------|--------|
| `UserPromptSubmit` | A new turn starting on a session that is already over | The turn never runs — the cheapest possible stop |
| `PreToolUse` | The loop running away *inside* one turn | The next tool call is denied |

`PreToolUse` is the one that matters. A single turn can make hundreds of tool
calls; checking only at the prompt boundary means the budget is enforced once
per turn, long after the damage.

## Configuration

`~/.config/ponytail/config.json` (or `%APPDATA%\ponytail\config.json`):

```json
{
  "spend": {
    "limit": 5,
    "warnAt": 0.75,
    "mode": "block"
  }
}
```

| Key | Env var | Default | Meaning |
|-----|---------|---------|---------|
| `limit` | `PONYTAIL_SPEND_LIMIT` | none — feature off | Per-session budget in USD |
| `warnAt` | `PONYTAIL_SPEND_WARN` | `0.75` | Warning threshold; `0.75` or `"75%"` |
| `mode` | `PONYTAIL_SPEND_MODE` | `block` | `off`, `warn`, or `block` |
| `prices` | — | built-in table | Per-model rate overrides |

Env wins over the config file, matching how `PONYTAIL_DEFAULT_MODE` works.

### Price overrides

The built-in table carries Anthropic list prices. If you are on a negotiated
rate, a partner platform with its own pricing (Bedrock, Vertex), or a model the
table doesn't know, override it — USD per 1M tokens:

```json
{
  "spend": {
    "limit": 5,
    "prices": {
      "claude-opus-5": { "input": 4, "output": 20 },
      "my-local-model": { "input": 0, "output": 0 }
    }
  }
}
```

## How the number is arrived at

The agent already writes a JSONL transcript of the session, and every assistant
message in it carries the `usage` block the API returned. The firewall reads
that. No API calls, no estimation, no tokenizer — the counts are the ones you
were billed for.

Three things about that file shape the implementation:

**One message spans several lines.** The transcript writes one line per content
block, and every line repeats the same `usage`. Summing lines roughly doubles
the total — a measured session had 61 lines carrying 29 real messages. Messages
are deduped by `message.id`.

**It only grows.** Re-reading the whole file on every tool call is work
proportional to session length, inside a 5-second hook timeout. Only the bytes
appended since the last check are read, and the byte offset lives in the ledger.

**It is written while you read it.** The last line is often half-flushed, so
reading stops at the final newline and picks the rest up next time.

Cache tokens are priced at their own multipliers off the input rate — 1.25× for
a 5-minute cache write, 2× for a 1-hour write, 0.1× for a read. Cache reads are
cheap, not free, and a loop that re-reads a 200k-token prefix every turn is
exactly the runaway this catches.

A model no table knows is counted in tokens but not in dollars, and
`/ponytail spend` says so rather than quietly reading low.

## State

One JSON file per session under `~/.config/ponytail/spend/`. Per-session files
rather than one shared one because sessions run concurrently and would clobber
each other. Written temp-then-rename, so a hook killed by its timeout can't
leave a truncated ledger that reads as "$0 spent". Files older than seven days
are swept on the first read of a new session.

## Host support

| Host | Meter | Warn | Block |
|------|-------|------|-------|
| Claude Code | ✅ | ✅ | ✅ both checkpoints |
| Codex, Qoder | ✅ | ✅ | advisory only |

Hard denial needs the host to honour a hook's deny decision, which only native
Claude Code is known to do on both events. Elsewhere the same message is
injected as context — the agent is told to stop, it just isn't forced to.

Copilot is deliberately not wired: it ignores hook output on every event except
session start, so the firewall could meter there but never report or stop
anything. The adapters that use a JS plugin API rather than hook manifests —
OpenCode, pi, Hermes, Gemini — are not wired yet either.

## When it fails

Every failure path allows the work through. An unreadable transcript, a corrupt
ledger, malformed hook input, a bug in the guard itself — all of them mean
"don't block". A firewall that wedges a session over its own bug costs more
than the bill it was preventing.

The one deliberate inaccuracy is in the same direction: a cold read of a
transcript larger than 32 MB starts from the tail rather than stalling the hook,
so very long pre-existing sessions can under-count.

## What this is not

It is not billing, metering-as-a-service, or a payment integration. There is no
account, no network call, and no third party — the budget is a number in your
own config file, and the meter reads a file already on your disk. If you need to
charge *your* users for *their* agent usage, that is a different problem and
belongs in your application, not in a plugin that makes agents write less code.
