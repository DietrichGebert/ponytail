---
name: gavel-help
description: >
  Quick-reference card for all gavel modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /gavel-help,
  "gavel help", "what gavel commands", "how do I use gavel".
---

# Gavel Help

Display this reference card when invoked. One-shot, do NOT change mode,
write flag files, or persist anything.

## Levels

| Level | Trigger | What changes |
|-------|---------|-------------|
| **Lite** | `/gavel lite` | Write what's asked, name the leaner test approach in one line. |
| **Full** | `/gavel` | QA ladder enforced: YAGNI -> reuse -> framework -> semantic locators -> POM -> one assertion -> minimum test. Default. |
| **Strict** | `/gavel strict` | Zero tolerance. Every Test Constitution rule is a hard gate. No exceptions. |

Level sticks until changed or session end.

## Core Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **gavel** | `/gavel` | QA discipline mode itself. Test Constitution enforcement. |
| **gavel-review** | `/gavel-review` | Test diff review: over-testing, fat specs, Constitution violations. |
| **gavel-audit** | `/gavel-audit` | Whole-suite audit: dead POMs, unused locators, bloat, violations. |
| **gavel-debt** | `/gavel-debt` | Harvest `gavel:` deferral comments into a debt ledger. |
| **gavel-gain** | `/gavel-gain` | Test quality scoreboard: pass rate, flake count, LOC per test. |
| **gavel-help** | `/gavel-help` | This card. |

## QA Workflow Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **gavel-plan** | `/gavel-plan` | ISTQB-aligned test planning, coverage gap analysis. |
| **gavel-e2e** | `/gavel-e2e` | E2E test authoring: POM, locators, flows, fixture DI. |
| **gavel-api** | `/gavel-api` | API test scenarios: service layer, auth, contracts. |
| **gavel-run** | `/gavel-run` | Config, running tests, trace viewer, project setup. |
| **gavel-analyze** | `/gavel-analyze` | Post-run suite analysis: classify failures. |
| **gavel-bug** | `/gavel-bug` | Standardized bug reports from test failures. |
| **gavel-triage** | `/gavel-triage` | Backend source navigation to find bug root cause. |
| **gavel-close** | `/gavel-close` | Jira closure summaries after QA verification. |
| **gavel-env** | `/gavel-env` | Start and verify local testing environment. |
| **gavel-auth** | `/gavel-auth` | Multi-tenant authentication for tests. |
| **gavel-hub** | `/gavel-hub` | Hub/external API integration test setup. |
| **gavel-ci** | `/gavel-ci` | Cloud CI automation runner. |

## Diagnostic Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **gavel-heal** | `/gavel-heal` | Diagnose failing test: test bug, app bug, or env issue? |
| **gavel-flake** | `/gavel-flake` | Flaky test triage: races, shared state, timing. |
| **gavel-detect** | `/gavel-detect` | Auto-detect runner, language, locator, assertion, report, and CI capabilities. |
| **gavel-init** | `/gavel-init` | Bootstrap new QA project: scaffold POM, fixtures, factories. |

## Capability Profiles

| Profile type | Activated when detected |
|--------------|------------------------|
| **UI runner** | Browser automation runner, locator API, and visual/evidence artifacts. |
| **API runner** | HTTP client, schema validation, auth fixtures, and cleanup hooks. |
| **BDD runner** | Feature files, step bindings, scenario outlines, and tag filters. |
| **Unit/component runner** | Component mount harness, mocks, fixtures, and coverage outputs. |
| **CI runner** | Sharding, artifacts, retries, quarantine lane, and reports. |

## Deactivate

Say "stop gavel" or "normal mode". Resume anytime with `/gavel`.
`/gavel off` also works.

## Configure Default Mode

Default mode = `full`, auto-active every session. Change it:

**Environment variable** (highest priority):
```bash
export GAVEL_DEFAULT_MODE=strict
```

**Config file** (`~/.config/gavel/config.json`, Windows: `%APPDATA%\gavel\config.json`):
```json
{ "defaultMode": "strict" }
```

Set `"off"` to disable auto-activation. Activate manually with `/gavel`.

Resolution: env var > config file > `full`.

## More

Full docs + examples: https://github.com/dsolisp/gavel
