# Gavel — QA Guidelines for JetBrains Junie

This project uses **gavel** — a framework-adaptive QA automation toolkit.

## Quick Rules

1. **QA Ladder first**: Before writing any test, check if it's needed (YAGNI), reusable, or can be simpler.
2. **Test Constitution**: DI via fixtures, accessibility-first locators, factory data, step grouping, native assertions.
3. **No shortcuts**: No CSS/XPath selectors, no manual sleeps, no hardcoded data, no `any` types.
4. **POM discipline**: Locators separate from actions, composition over inheritance (max depth 1).
5. **Verify**: Run compile + lint + test after every change.

## Full Rules

See `AGENTS.md` at the project root for the complete always-on ruleset including:
- QA Ladder (7 rungs)
- Test Constitution (MUST DO + WON'T DO)
- Page Object Discipline
- Test Data Discipline
- Locator Priority
- Assertion Discipline
- Workflow Routing
- Verification Gate
- Framework Adaptation

## Supported Frameworks

Gavel auto-detects and adapts to: Playwright, Selenium, Cypress, WebdriverIO, Cucumber/Behave.

## Intensity Levels

- `lite`: Suggest improvements
- `full` (default): Enforce all rules
- `strict`: Zero tolerance
