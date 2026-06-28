<p align="center">
  <img src="assets/gavel.png" alt="Gavel - The judge's hammer for test quality" width="280">
  <h1 align="center">Gavel</h1>
  <p align="center">
    <em>The judge's hammer for test quality.</em><br>
    <em>Minimalism + QA discipline for AI agents.</em>
  </p>
  <p align="center">
    <img src="https://img.shields.io/github/v/release/dsolisp/gavel?style=flat-square&label=release" alt="Release">
    <img src="https://img.shields.io/badge/works%20with-20%2B%20IDEs-blue?style=flat-square" alt="Works with 20+ IDEs">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license">
  </p>
</p>

---

Gavel is a fork of [ponytail](https://github.com/DietrichGebert/ponytail) mutated into a **QA automation toolkit** that preserves ponytail's minimalism core while adding framework-adaptive test quality enforcement.

**The idea:** the best code is the code you never wrote (ponytail). The best test is the test that catches the real bug — no more, no less (gavel). Both ladders run on every decision.

## What it does

Before writing any code, gavel's agent climbs two ladders:

```
MINIMALISM LADDER (all code):
1. Does this need to exist?        → skip (YAGNI)
2. Already in this codebase?       → reuse it
3. Stdlib does it?                 → use it
4. Native platform feature?        → use it
5. Installed dependency?           → use it
6. One line?                       → one line
7. Only then: the minimum that works

QA LADDER (test code):
1. Does this test need to exist?   → skip (YAGNI)
2. Already in this test suite?     → reuse fixture/factory/POM
3. Framework handles it?           → use native assertions/waits
4. Native locator covers it?       → semantic > CSS > XPath
5. Existing POM covers it?         → extend, don't create new
6. One assertion?                  → one assertion
7. Only then: the minimum test that catches the real bug
```

> **Ladder Conflict Rule:** When the two ladders collide on test code, **the QA Ladder wins**. Minimalism is the default for production code; QA discipline is the override for test code because the cost of a missed assertion is a missed bug.

## What it includes

- **Core QA skills** — plan, author, run, review, audit, diagnose, triage, report, and close the loop
- **Specialist agents** — workflow roles that should stay few: route, generate, diagnose, analyze impact, audit exceptions, refactor only when reuse proves it
- **Stack-adaptive profiles** — detect runner capabilities, assertion semantics, locator APIs, fixture patterns, and reporting outputs without locking gavel to one tool
- **20+ IDE adapters** — Cursor, Cline, Windsurf, Kiro, Copilot, Trae, Comate, Lingma, Junie, Qoder, OpenCode, and more
- **Hook system** — SessionStart activation, SubagentStart injection, mode tracking
- **Test Constitution** — 9 MUST DO rules + 7 WON'T DO rules
- **Native-first testing patterns** — accessibility, visual, component, API/contract, retry, coverage, and quarantine rules expressed as reusable patterns

**New here?** Start with [QUICKSTART.md](QUICKSTART.md) — install → audit → heal → write, ten minutes to first verdict.

## Install

### Qoder
```
# Copy skills/ to .qoder/skills/ and agents/ to .qoder/agents/
```

### Claude Code
```
/plugin marketplace add dsolisp/gavel
/plugin install gavel@gavel
```

### Cursor / Windsurf / Cline / Copilot / Kiro
Copy the matching adapter from this repo:
- `.cursor/rules/gavel.mdc`
- `.clinerules/gavel.md`
- `.windsurf/rules/gavel.md`
- `.kiro/steering/gavel.md`
- `.github/copilot-instructions.md`

### OpenCode
```json
{ "plugin": ["./.opencode/plugins/gavel.mjs"] }
```

### Gemini CLI
```bash
gemini extensions install https://github.com/dsolisp/gavel
```

## Commands

| Command | What it does |
|---------|-------------|
| `/gavel [lite \| full \| strict \| off]` | Set intensity level |
| `/gavel-review` | Review test diffs for constitution violations |
| `/gavel-audit` | Whole-repo audit for test suite bloat |
| `/gavel-debt` | Harvest `gavel:` deferred test decisions |
| `/gavel-gain` | Show test quality scoreboard (pass rate, coverage, flake count) |
| `/gavel-detect` | Auto-detect your test stack |
| `/gavel-heal` | Diagnose a failing test |
| `/gavel-flake` | Flaky test triage + quarantine |
| `/gavel-init` | Bootstrap a new QA project |
| `/gavel-help` | Quick reference |

## Intensity Levels

| Level | What changes |
|-------|-------------|
| **lite** | Suggest improvements, name the lazier alternative |
| **full** (default) | Enforce all rules, block constitution violations |
| **strict** | Zero tolerance — reject any violation |
| **off** | Disable gavel; revert to base IDE behavior |

## Configuration

Set default mode via env var or config file:
```bash
GAVEL_DEFAULT_MODE=strict
# or
~/.config/gavel/config.json  # { "defaultMode": "strict" }
```

## Framework Adaptation

Gavel adapts by capability, not by brand. Detection answers these questions, then applies the universal QA rules through the native primitives your stack already has:

| Capability | Adaptation rule |
|------------|-----------------|
| **Runner lifecycle** | Use the suite's fixture/hook model for DI, setup, cleanup, and isolation. |
| **Locator surface** | Prefer semantic/accessibility locators, then stable test IDs, then structural selectors only when semantics do not exist. |
| **Assertion semantics** | Use built-in retrying/eventual assertions before custom polling or sleeps. |
| **Composition model** | Reuse existing fixtures, factories, service clients, page actions, or step definitions before adding abstractions. |
| **Evidence output** | Read the stack's native traces, screenshots, videos, logs, reports, and failure artifacts before changing tests. |
| **Verification commands** | Run the project's existing type, lint, targeted test, and coverage gates instead of hardcoding a runner. |

## Native Capability Patterns

Use the stack's own capabilities instead of pulling in dependencies.

| Pattern | When | Native-first rule |
|---------|------|-------------------|
| **Accessibility verification** | Validate user-perceivable structure | Use native accessibility snapshots/queries before adding external scanners. |
| **Visual regression** | Catch unintended CSS/layout drift | Use runner-integrated screenshots/diffs before adding visual infrastructure. |
| **Component isolation** | Exercise UI logic below full E2E cost | Use the project's existing component mount/test harness. |
| **API/contract checks** | Verify service boundaries and schema drift | Reuse existing request clients, fixtures, and schema validators. |
| **Eventual assertions** | Replace flaky wait loops | Use the framework's built-in retry/assertion model. |
| **Coverage thresholding** | Protect critical paths | Use the repository's coverage tool and raise thresholds for high-risk flows. |

## The 4-Line Verification Gate

Before declaring work done, run all four. Any failure blocks the merge.

```bash
<project type-check>      # 1. type-check / compile
<project lint>            # 2. lint / style gate
<targeted test command>   # 3. affected test or suite
<coverage command>        # 4. coverage threshold where configured
```

Coverage defaults to **80%**. Raise it for critical paths (auth, payment, tenant isolation). Lower it for throwaway code.

## Quarantine Policy

Flaky tests get a home, not a retry and not a delete.

| Tag | Meaning | Action |
|-----|---------|--------|
| `@flaky:env` | Environment-dependent (network, seed timing) | Quarantine CI lane |
| `@flaky:data` | Data/seed-dependent (shared rows, races) | Quarantine CI lane |
| `@flaky:ui` | DOM/animation-dependent (animation, virtualization) | Quarantine CI lane |
| `@wip` | Test under construction | Skip in CI, must remove before merge |

Quarantined tests run in a separate CI lane that **never blocks merge**. They appear in the weekly `gavel-flake` report. After 7 days, an unfixed quarantine escalates: becomes a real bug ticket, gets fixed, or gets deleted.

## test.fail() Expiry

`test.fail()` markers are valid for **7 days**. Run `gavel-fail-audit` weekly to clear the rot: each marker either becomes a real bug ticket, gets fixed, or gets deleted. No permanent "this is broken" comments.

## How it relates to ponytail

Gavel is a [fork](https://github.com/DietrichGebert/ponytail) that keeps ponytail's minimalism philosophy as the foundation and adds QA discipline on top. The upstream remote is preserved for syncing ponytail improvements:

```bash
git fetch upstream
git merge upstream/main
```

## Development

```bash
node scripts/check-rule-copies.js --check-all  # verify adapter sync
node scripts/check-versions.js                  # version consistency
node scripts/verify-agents-md.js                # AGENTS.md sections
node scripts/verify-skills.js                   # all skills/agents exist
npm test                                        # all checks
```

## License

[MIT](LICENSE). Based on [ponytail](https://github.com/DietrichGebert/ponytail) by Dietrich Gebert.
