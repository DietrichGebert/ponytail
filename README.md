<p align="center">
  <img src="assets/logo.png" width="220" alt="Ponytail, the lazy senior dev">
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>He says nothing. He writes one line. It works.</em>
</p>

---

You know him. Long ponytail. Oval glasses. Has been at the company longer than the version control. You show him fifty lines; he looks at them, says nothing, and replaces them with one.

Ponytail puts him inside your AI agent.

## Before / after

You ask for a date picker. Your agent installs flatpickr, writes a wrapper component, adds a stylesheet, and starts a discussion about timezones.

With ponytail:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

More survivors in [examples/](examples/).

## Numbers

Six tasks: streaming log parser, atomic file sync, notification dispatcher, validation engine, auth module, concurrent money ledger. One spec each, one fresh agent per arm, same model. Three arms: no skill, the [caveman](https://github.com/JuliusBrussee/caveman) skill, and ponytail. Every arm passes the same adversarial security and concurrency probes. Then the agreement ends:

<p align="center">
  <img src="assets/benchmark-loc.svg" width="860" alt="Lines of code per task: ponytail 490 total vs caveman 1,440 vs no-skill control 3,629, all passing the same adversarial probes">
</p>

**47% fewer tokens than the no-skill agent. 3× faster. A seventh of the code.** The 3,139 lines nobody wrote have never caused an incident. When a surprise feature request hit two of the tasks, ponytail extended in 96 changed lines; caveman needed 413, the no-skill agent 1,115. Every shortcut ponytail took is marked in the code with a `ponytail:` comment naming its upgrade path. Data: [benchmarks/](benchmarks/).

## How it works

Before writing code, the agent stops at the first rung that holds:

```
1. Does this need to exist?   → no: skip it (YAGNI)
2. Stdlib does it?            → use it
3. Native platform feature?   → use it
4. Installed dependency?      → use it
5. One line?                  → one line
6. Only then: the minimum that works
```

Lazy, not negligent: trust-boundary validation, data-loss handling, security, and accessibility are never on the chopping block.

## Install

The most effort ponytail will ever ask of you:

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex
```

Open `/plugins`, select the Ponytail marketplace, and install Ponytail. Then
open `/hooks`, review and trust its two lifecycle hooks, and start a new thread.

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

That was it. He'd be proud. He won't say it.

Active every session. `/ponytail-review` finds what to delete in your diff. `/ponytail ultra` exists for when the codebase has wronged you personally. `/ponytail-help` explains the rest.

In Codex, invoke the skills as `@ponytail`, `@ponytail-review`, and
`@ponytail-help`. Startup and mode-change text shows the current mode.

Cursor, Windsurf, Cline, Copilot, Aider, Kiro: copy the matching rules file from this repo ([`.cursor/rules/`](.cursor/rules/), [`.windsurf/rules/`](.windsurf/rules/), [`.clinerules/`](.clinerules/), [`.github/copilot-instructions.md`](.github/copilot-instructions.md), [`AGENTS.md`](AGENTS.md), [`.kiro/steering/`](.kiro/steering/)).

Kiro: copy `.kiro/steering/ponytail.md` to `~/.kiro/steering/` (global) or `.kiro/steering/` in your project.

Which files map to which agent: [Agent portability](docs/agent-portability.md).

## Development

When changing the compact rule text, keep the agent copies aligned:

```bash
node scripts/check-rule-copies.js
```

## FAQ

**Does it need a config file?**
No.

**What if I really need the 120-line cache class?**
You don't. Insist anyway and he'll build it. Slowly. Correctly. While looking at you.

**Does it scale?**
The code you never wrote scales infinitely. Zero bugs, zero CVEs, 100% uptime since forever.

**Why "ponytail"?**
You know exactly why.

## License

[MIT](LICENSE). The shortest license that works.
