# POM Composition — Same Concept, Four Frameworks

Page Object Model patterns across frameworks. Each framework has its own idiomatic approach to separating locators, actions, and page composition.

## Playwright — Mixin Composition

```typescript
// locators/DashboardLocators.ts
export class DashboardLocators {
  constructor(private page: Page) {}

  get welcomeMessage() { return this.page.getByRole('heading', { name: 'Welcome' }); }
  get accountBalance() { return this.page.getByTestId('account-balance'); }
  get tradeButton() { return this.page.getByRole('button', { name: 'New Trade' }); }
}

// pages/actions/DashboardActions.ts
export class DashboardActions {
  constructor(private page: Page, public locators: DashboardLocators) {}

  async navigateTo(path: string) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  async getBalance(): Promise<string> {
    return (await this.locators.accountBalance.textContent()) ?? '';
  }
}

// fixtures/appFixtures.ts — DI via test.extend
import { test as base } from '@playwright/test';

export const test = base.extend<{ dashboardPage: DashboardActions }>({
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardActions(page, new DashboardLocators(page)));
  },
});

// specs — clean separation
import { test, expect } from '../../fixtures/appFixtures';

test('dashboard shows balance', async ({ dashboardPage }) => {
  await dashboardPage.navigateTo('/dashboard');
  const balance = await dashboardPage.getBalance();
  expect(balance).toBeTruthy();
});
```

**Pattern**: Locators class + Actions class + fixture DI. Mixin composition via constructor injection. Spec files never import page objects directly.

## Selenium — Class-Based POM

```python
# pages/base_page.py
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)

    def navigate_to(self, path):
        self.driver.get(f"{self.base_url}{path}")

    def wait_for_visible(self, locator):
        return self.wait.until(EC.visibility_of_element_located(locator))

# pages/dashboard_page.py
from selenium.webdriver.common.by import By

class DashboardPage(BasePage):
    # Locators
    _WELCOME = (By.CSS_SELECTOR, 'h1[role="heading"]')
    _BALANCE = (By.CSS_SELECTOR, '[data-testid="account-balance"]')
    _TRADE_BTN = (By.CSS_SELECTOR, 'button[data-testid="new-trade"]')

    # Actions
    def get_welcome_text(self):
        return self.wait_for_visible(self._WELCOME).text

    def get_balance(self):
        return self.wait_for_visible(self._BALANCE).text

    def click_new_trade(self):
        self.wait_for_visible(self._TRADE_BTN).click()

# conftest.py — pytest fixture DI
import pytest

@pytest.fixture
def dashboard_page(driver):
    return DashboardPage(driver)

# tests — clean separation
def test_dashboard_shows_balance(dashboard_page):
    dashboard_page.navigate_to('/dashboard')
    balance = dashboard_page.get_balance()
    assert balance
```

**Pattern**: Class-based POM with inheritance from BasePage. Locators as class attributes (tuples). Actions as methods. pytest fixture for DI.

## Cypress — Custom Commands + Service Objects

```javascript
// support/commands.js — custom commands for common actions
Cypress.Commands.add('login', (email, password) => {
  cy.get('[role="textbox"][aria-label="Email"]').clear().type(email);
  cy.get('[role="textbox"][aria-label="Password"]').clear().type(password);
  cy.get('button').contains('Sign in').click();
});

// pages/dashboard.js — service object pattern
export class DashboardPage {
  visit() {
    cy.visit('/dashboard');
  }

  getWelcomeText() {
    return cy.get('h1[role="heading"]').invoke('text');
  }

  getBalance() {
    return cy.get('[data-testid="account-balance"]').invoke('text');
  }

  clickNewTrade() {
    cy.get('button[data-testid="new-trade"]').click();
  }
}

// cypress/e2e/dashboard.cy.js — clean separation
import { DashboardPage } from '../pages/dashboard';

describe('Dashboard', () => {
  const dashboard = new DashboardPage();

  beforeEach(() => {
    cy.login('user@test.com', 'password');
    dashboard.visit();
  });

  it('shows account balance', () => {
    dashboard.getBalance().should('not.be.empty');
  });
});
```

**Pattern**: Custom commands for shared actions. Service objects for page interactions. `beforeEach` for setup. No class inheritance.

## WebdriverIO — Service Objects

```typescript
// pageobjects/base.page.ts
export class BasePage {
  async navigateTo(path: string) {
    await browser.url(path);
  }
}

// pageobjects/dashboard.page.ts
export class DashboardPage extends BasePage {
  get welcomeMessage() { return $('h1[role="heading"]'); }
  get accountBalance() { return $('[data-testid="account-balance"]'); }
  get tradeButton() { return $('button[data-testid="new-trade"]'); }

  async getBalanceText(): Promise<string> {
    await this.accountBalance.waitForDisplayed();
    return this.accountBalance.getText();
  }

  async clickNewTrade() {
    await this.tradeButton.waitForClickable();
    await this.tradeButton.click();
  }
}

// support/fixtures.ts — DI setup
export async function createFixtures() {
  return {
    dashboardPage: new DashboardPage(),
  };
}

// specs — clean separation
import { DashboardPage } from '../pageobjects/dashboard.page';

describe('Dashboard', () => {
  const dashboardPage = new DashboardPage();

  it('shows account balance', async () => {
    await dashboardPage.navigateTo('/dashboard');
    const balance = await dashboardPage.getBalanceText();
    expect(balance).toBeTruthy();
  });
});
```

**Pattern**: Getter-based locators in page classes. `waitFor*()` methods for waits. Service objects instantiated directly or via factory.

## Summary

| Framework | Locator Pattern | DI Pattern | Composition |
|-----------|----------------|------------|-------------|
| Playwright | Separate `Locators` class | `test.extend()` fixtures | Mixin (constructor injection) |
| Selenium | Class attributes (By tuples) | `pytest.fixture` | Inheritance (BasePage) |
| Cypress | Inline in service objects | `beforeEach` hooks | Custom commands |
| WebdriverIO | Getter properties in page class | Direct instantiation | Service objects |
