# Login E2E Test — Same Concept, Four Frameworks

The same login test written in Playwright, Selenium, Cypress, and WebdriverIO. Notice how gavel's principles (accessibility locators, DI, factories, step grouping) adapt to each framework's idioms.

## Playwright (TypeScript)

```typescript
import { test, expect } from '../../fixtures/appFixtures';
import { UserFactory } from '../../support/factories';

test.describe('Login', () => {
  test('valid credentials redirect to dashboard @smoke', async ({ page, loginPage }) => {
    const user = UserFactory.create({ role: 'trader' });

    await test.step('Navigate to login', async () => {
      await loginPage.navigateTo('/login');
    });

    await test.step('Enter credentials', async () => {
      await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
      await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
    });

    await test.step('Submit and verify', async () => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  test('invalid credentials show error @regression', async ({ page, loginPage }) => {
    await test.step('Enter wrong credentials', async () => {
      await loginPage.navigateTo('/login');
      await page.getByRole('textbox', { name: 'Email' }).fill('wrong@test.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('wrongpass');
    });

    await test.step('Verify error message', async () => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Invalid credentials')).toBeVisible();
    });
  });
});
```

**Key patterns**: `getByRole` locators, `test.step()` grouping, fixture DI (`{ page, loginPage }`), factory data, web-first assertions (`expect().toBeVisible()`).

## Selenium (Python)

```python
import pytest
from factories import UserFactory

class TestLogin:
    def test_valid_credentials_redirect(self, driver, login_page):
        user = UserFactory.create(role='trader')

        # Navigate to login
        login_page.navigate_to('/login')

        # Enter credentials
        login_page.enter_email(user.email)
        login_page.enter_password(user.password)

        # Submit and verify
        login_page.click_sign_in()
        assert login_page.is_dashboard_visible()

    def test_invalid_credentials_show_error(self, driver, login_page):
        login_page.navigate_to('/login')
        login_page.enter_email('wrong@test.com')
        login_page.enter_password('wrongpass')
        login_page.click_sign_in()
        assert login_page.is_error_visible('Invalid credentials')
```

**Key patterns**: pytest fixture DI (`driver`, `login_page`), class-based POM, factory data, explicit waits inside page methods, plain `assert`.

**Login page object (Selenium)**:
```python
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class LoginPage:
    def __init__(self, driver):
        self.driver = driver
        self._email = (By.CSS_SELECTOR, '[role="textbox"][aria-label="Email"]')
        self._password = (By.CSS_SELECTOR, '[role="textbox"][aria-label="Password"]')
        self._submit = (By.CSS_SELECTOR, 'button[role="button"]')

    def navigate_to(self, path):
        self.driver.get(f"{self.base_url}{path}")

    def enter_email(self, email):
        el = WebDriverWait(self.driver, 10).until(EC.presence_of_element_located(self._email))
        el.clear()
        el.send_keys(email)

    def click_sign_in(self):
        self.driver.find_element(*self._submit).click()

    def is_dashboard_visible(self):
        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'h1'))
            )
            return True
        except:
            return False
```

## Cypress (JavaScript)

```javascript
describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('valid credentials redirect to dashboard @smoke', () => {
    const user = UserFactory.create({ role: 'trader' });

    cy.get('[role="textbox"][aria-label="Email"]').clear().type(user.email);
    cy.get('[role="textbox"][aria-label="Password"]').clear().type(user.password);
    cy.get('button[role="button"]').contains('Sign in').click();

    cy.get('h1').should('contain', 'Dashboard');
  });

  it('invalid credentials show error @regression', () => {
    cy.get('[role="textbox"][aria-label="Email"]').clear().type('wrong@test.com');
    cy.get('[role="textbox"][aria-label="Password"]').clear().type('wrongpass');
    cy.get('button[role="button"]').contains('Sign in').click();

    cy.contains('Invalid credentials').should('be.visible');
  });
});
```

**Key patterns**: `beforeEach` setup, auto-retry assertions (`.should()`), `cy.intercept()` for API mocking, factory data, `cy.get()` with semantic selectors.

## WebdriverIO (TypeScript)

```typescript
describe('Login', () => {
  it('valid credentials redirect to dashboard @smoke', async () => {
    const user = UserFactory.create({ role: 'trader' });

    await browser.url('/login');

    const emailInput = $('input[aria-label="Email"]');
    await emailInput.waitForDisplayed();
    await emailInput.setValue(user.email);

    const passwordInput = $('input[aria-label="Password"]');
    await passwordInput.setValue(user.password);

    const signInButton = $('button=Sign in');
    await signInButton.click();

    const dashboard = $('h1=Dashboard');
    await expect(dashboard).toBeDisplayed();
  });

  it('invalid credentials show error @regression', async () => {
    await browser.url('/login');
    await $('input[aria-label="Email"]').setValue('wrong@test.com');
    await $('input[aria-label="Password"]').setValue('wrongpass');
    await $('button=Sign in').click();

    await expect($('div*=Invalid credentials')).toBeDisplayed();
  });
});
```

**Key patterns**: `$()` with semantic selectors, `waitForDisplayed()`, `expect().toBeDisplayed()`, factory data, async/await throughout.
