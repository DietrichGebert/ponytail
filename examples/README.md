# Gavel Examples

Same test concept, different frameworks. See how gavel adapts its patterns to whatever stack you have.

| Concept | Playwright (TS) | Selenium (Python) | Cypress (JS) | WebdriverIO (TS) |
|---|---|---|---|---|
| [Login E2E test](login-e2e.md) | `getByRole` + fixture DI | `WebDriverWait` + pytest fixture | `cy.intercept` + custom commands | `waitForDisplayed` + service objects |
| [API CRUD test](api-crud.md) | Service fixtures + `toBeApiError` | `requests` + pytest classes | `cy.request` + beforeEach | REST client + DI |
| [Form validation](form-validation.md) | `test.step()` + web-first asserts | Explicit waits + assertions | Auto-retry `.should()` | `waitForClickable` + expects |
| [POM composition](pom-pattern.md) | Mixin composition | Class-based + constructor | Custom commands | Service objects |

Each example shows:
1. The **locator strategy** for that framework
2. The **assertion pattern** (web-first, auto-retry, explicit wait)
3. The **DI pattern** (fixtures, hooks, constructors)
4. The **POM pattern** (mixins, classes, commands, services)
5. The **wait strategy** (auto-retry, explicit, implicit)

These are reference patterns — not copy-paste templates. Gavel adapts them to your actual project structure.
