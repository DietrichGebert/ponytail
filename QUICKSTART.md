# Gavel Quickstart

The judge's hammer for test quality. Five commands and one audit. Ten minutes from install to first verdict.

## 1. Install (1 minute)

```bash
# Claude Code
/plugin marketplace add dsolisp/gavel
/plugin install gavel@gavel
```

For other IDEs: see [README.md](README.md). The plugin auto-loads the QA Constitution on every session.

## 2. Open your test repo (1 minute)

Point gavel at any project with an existing test suite. Playwright, Selenium, Cypress, WebdriverIO, or Cucumber — gavel detects the stack automatically.

## 3. Audit (2 minutes)

```
/gavel-audit
```

Gavel scans the whole repo and returns a ranked list of violations:

```
Suite health:
  142 tests, 38 specs, 12 page objects
  Constitution violations:
    css-loc:        31
    no-step:        18
    no-di:           9
    hardcoded:       7
    manual-wait:     4
    over-test:       3
  Dead code:        2 unused POMs, 14 dead locators
  net: -284 lines possible.
```

Each finding has a one-line replacement. Take the top 5.

## 4. Heal a failing test (2 minutes)

```
/gavel-heal tests/checkout.spec.ts "discount code applies to subtotal"
```

Gavel returns a verdict (TEST BUG / APP BUG / ENV ISSUE / FLAKY / AMBIGUOUS) with evidence and a recommended fix. Apply the fix, re-run.

## 5. Write one test, the gavel way (3 minutes)

```
/gavel-e2e Add a test that the empty cart shows the 'Browse Products' CTA.
```

Gavel climbs the QA Ladder, applies the Test Constitution, and generates:

- Semantic locator (`getByRole('link', { name: 'Browse Products' })`)
- Fixture DI (no direct instantiation)
- Factory data (no hardcoded strings)
- `test.step()` grouping
- Web-first assertion
- One assertion per line

After generation, run the [4-line verification gate](skills/gavel-run/SKILL.md).

## 6. Set your intensity

```
/gavel full      # default: enforce all rules
/gavel strict    # zero tolerance
/gavel lite      # suggest only
/gavel off       # disable
```

`strict` is for release branches and protected main. `lite` is for spike work. `full` is the daily driver.

## What's next

- See [examples/](examples/) for cross-framework patterns (Playwright, Selenium, Cypress, WebdriverIO)
- See [skills/](skills/) for the full 28-skill catalog
- See [AGENTS.md](AGENTS.md) for the complete ruleset (Minimalism Ladder + QA Ladder + Test Constitution)
- See [skills/gavel-flake/SKILL.md](skills/gavel-flake/SKILL.md) for the flaky-test quarantine policy
- See [skills/gavel-run/SKILL.md](skills/gavel-run/SKILL.md) for the verification gate and parallel execution

One test. One verdict. Move on.