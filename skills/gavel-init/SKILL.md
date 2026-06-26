---
name: gavel-init
description: Bootstrap a new QA project. Scaffold POM, fixtures, factories for the detected framework. Creates the minimum viable test structure so you can start writing tests immediately. Framework-adaptive — generates the correct patterns per active profile.
---

# Gavel Init

Bootstrap a new QA automation project. Create the minimum structure. Start testing.

## When to Use

- Starting a new test suite from scratch
- Setting up POM, fixtures, factories for a new project
- After `gavel-detect` identifies the stack

## Workflow

### Step 1: Detect stack

Run `gavel-detect` first. If no framework is detected, ask the user:
- Which automation framework? (Playwright, Selenium, Cypress, WebdriverIO)
- Which test runner? (Playwright runner, pytest, JUnit, Mocha, etc.)
- Which language? (TypeScript, JavaScript, Python, Java)

### Step 2: Scaffold

Create the minimum viable structure for the detected framework:

#### Playwright (TypeScript)

```
tests/
  fixtures/
    appFixtures.ts        -- test.extend() with page, services, POMs
  support/
    fixtures.ts           -- API test fixtures (services)
    factories.ts          -- Test data factories
    matchers.ts           -- Custom matchers (if needed)
  locators/
    BaseLocators.ts       -- Base locator class
    <feature>Locators.ts  -- Feature-specific locators
  pages/
    BasePage.ts           -- Base page with navigateTo()
    actions/
      <feature>Actions.ts -- Mixin actions
  <feature>/
    <feature>.spec.ts     -- First test file
playwright.config.ts
tsconfig.json
package.json
```

#### Selenium (Python)

```
tests/
  conftest.py             -- pytest fixtures (driver, pages)
  pages/
    base_page.py          -- BasePage with navigate, wait helpers
    <feature>_page.py     -- Feature page objects
  locators/
    <feature>_locators.py -- Locator definitions
  factories/
    base_factory.py       -- Base factory class
    <entity>_factory.py   -- Entity factories
  services/
    base_service.py       -- API service base
    <feature>_service.py  -- Feature services
  <feature>/
    test_<feature>.py     -- First test file
requirements.txt
pytest.ini / pyproject.toml
```

#### Cypress (JavaScript)

```
cypress/
  e2e/
    <feature>.cy.js       -- First test file
  support/
    commands.js            -- Custom commands
    e2e.js                 -- Global hooks
  pages/
    <feature>.js           -- Page objects (service pattern)
  factories/
    <entity>.js            -- Test data factories
cypress.config.js
package.json
```

#### WebdriverIO (TypeScript)

```
test/
  specs/
    <feature>.spec.ts      -- First test file
  pageobjects/
    <feature>.page.ts      -- Page objects (service pattern)
  services/
    <feature>.service.ts   -- API services
  factories/
    <entity>.factory.ts    -- Test data factories
  support/
    fixtures.ts            -- DI setup
wdio.conf.ts
tsconfig.json
package.json
```

#### Cucumber (Gherkin)

```
features/
  <feature>.feature        -- Feature file
  step_definitions/
    <feature>.steps.ts     -- Step definitions (JS/TS)
    <feature>.steps.py     -- Step definitions (Python/Behave)
  support/
    world.ts               -- World/context setup
    hooks.ts               -- Before/After hooks
  pages/
    <feature>.ts           -- Page objects
```

### Step 3: First test

Generate one passing smoke test to verify the scaffold works:

```
1. Create the test file
2. Run it → must pass
3. Run compile/lint → must pass
4. If anything fails, fix the scaffold
```

### Step 4: Verify

```bash
# TypeScript projects
npx tsc --noEmit
npx eslint .

# Python projects
pytest --collect-only
ruff check .

# Java projects
mvn compile -q
```

## Rules

- Minimum structure only. Don't scaffold things the project doesn't need.
- One passing test. Not ten failing ones.
- Follow the active framework profile's conventions.
- If the project already has some structure, extend it — don't overwrite.
- Ask before creating more than the minimum. YAGNI.
