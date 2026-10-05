# Contributing

Thanks for helping. Here is what gets merged, and what needs to come with it.

## New skills come from me

I add new skills myself, so please open an issue with the idea instead of a PR.

## Changes to the ruleset need a benchmark

The ruleset is what every ponytail user loads in every session. That means `skills/`, `AGENTS.md`,
the rule copies (`.cursor/`, `.windsurf/`, `.clinerules/`, `.agents/`, `.qoder/`, `.kiro/`,
`.github/copilot-instructions.md`), `.openclaw/skills/`, and anything else that changes what the
agent is told.

I only merge a change there if the PR shows a benchmark with three arms, same task, same model:

1. `baseline` (no ponytail)
2. current ponytail (`main`)
3. ponytail with your change

The PR should show:

- a task where your change should make a difference, and the numbers showing it does,
- at least one existing task it could break, and the numbers showing it doesn't (a new rule
  often fights an old one),
- at least 6 runs per arm on a current model, and which model you used.

Without that, the PR gets closed, however good the idea is.

[`benchmarks/agentic/run.py`](benchmarks/agentic/run.py) does the work (setup in
[its README](benchmarks/agentic/README.md#reproduce)). The `ponytail` arm loads the plugin from
`PONYTAIL_PLUGIN_DIR`, so run it once against a checkout of `main` and once against your branch:

```bash
cd benchmarks/agentic
python run.py --selftest
PONYTAIL_PLUGIN_DIR=/abs/path/to/ponytail-main python run.py --task <task> --arms baseline,ponytail --models opus --runs 6
PONYTAIL_PLUGIN_DIR=/abs/path/to/your-branch python run.py --task <task> --arms ponytail --models opus --runs 6
```

If your task isn't in `tasks.py` yet, add it with a `good` and a `bad` reference, so `--selftest`
proves the scorer catches the difference.

Rule text lives in `AGENTS.md` and `skills/ponytail/SKILL.md`. Keep the copies in sync
(`node scripts/check-rule-copies.js`) and regenerate `.openclaw/` with
`node scripts/build-openclaw-skills.js`.

## Everything else

Bug fixes in hooks, installers, adapters, and docs don't need a benchmark. Before you open the PR:

```bash
npm test
node scripts/check-rule-copies.js
node scripts/check-versions.js
```

Keep the PR to one change and link the issue it fixes.

## Development

When changing the compact rule text, keep the agent copies aligned:

```bash
node scripts/check-rule-copies.js
npm test
```

The OpenClaw skill package (`.openclaw/skills/`) is generated from `skills/`; rerun `node scripts/build-openclaw-skills.js` after changing a skill, the test suite fails if it is stale. To publish the skills to ClawHub, run `clawhub login` once, then `node scripts/publish-openclaw-skills.js` (it publishes all six at the `package.json` version; pass `--dry-run` to preview).

The correctness benchmark spawns Python for email and CSV checks; `python3` is tried before `python`. CSV checks need `pandas` installed locally.
