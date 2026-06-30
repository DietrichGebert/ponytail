# Form Validation — Same Concept, Four Frameworks

Same form validation test (required fields, invalid format, successful submit) across frameworks. Shows assertion patterns and wait strategies.

## Playwright (TypeScript)

```typescript
import { test, expect } from '../../fixtures/appFixtures';
import { UserFactory } from '../../support/factories';

test.describe('Registration Form', () => {
  test('required fields show errors when empty @smoke', async ({ page, registrationPage }) => {
    await test.step('Navigate to registration', async () => {
      await registrationPage.navigateTo('/register');
    });

    await test.step('Submit empty form', async () => {
      await page.getByRole('button', { name: 'Register' }).click();
    });

    await test.step('Verify error messages', async () => {
      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
    });
  });

  test('invalid email format shows error @regression', async ({ page, registrationPage }) => {
    await test.step('Enter invalid email', async () => {
      await registrationPage.navigateTo('/register');
      await page.getByRole('textbox', { name: 'Email' }).fill('not-an-email');
      await page.getByRole('button', { name: 'Register' }).click();
    });

    await test.step('Verify format error', async () => {
      await expect(page.getByText('Enter a valid email')).toBeVisible();
    });
  });

  test('valid data creates account @smoke', async ({ page, registrationPage }) => {
    const user = UserFactory.create();

    await test.step('Fill form', async () => {
      await registrationPage.navigateTo('/register');
      await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
      await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
    });

    await test.step('Submit and verify', async () => {
      await page.getByRole('button', { name: 'Register' }).click();
      await expect(page.getByText('Account created')).toBeVisible();
    });
  });
});
```

**Assertion pattern**: `await expect(locator).toBeVisible()` — web-first, auto-retries until timeout.

## Selenium (Python)

```python
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from factories import UserFactory

class TestRegistrationForm:
    def test_required_fields_show_errors(self, driver, registration_page):
        registration_page.navigate_to('/register')
        registration_page.click_register()

        error = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]'))
        )
        assert 'Email is required' in error.text

    def test_invalid_email_format(self, driver, registration_page):
        registration_page.navigate_to('/register')
        registration_page.enter_email('not-an-email')
        registration_page.click_register()

        error = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]'))
        )
        assert 'valid email' in error.text

    def test_valid_data_creates_account(self, driver, registration_page):
        user = UserFactory.create()
        registration_page.navigate_to('/register')
        registration_page.enter_email(user.email)
        registration_page.enter_password(user.password)
        registration_page.click_register()

        success = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, '.success-message'))
        )
        assert 'Account created' in success.text
```

**Wait pattern**: `WebDriverWait(driver, 10).until(EC.visibility_of_element_located(...))` — explicit wait with expected condition.

## Cypress (JavaScript)

```javascript
describe('Registration Form', () => {
  beforeEach(() => {
    cy.visit('/register');
  });

  it('required fields show errors when empty @smoke', () => {
    cy.contains('button', 'Register').click();
    cy.contains('Email is required').should('be.visible');
    cy.contains('Password is required').should('be.visible');
  });

  it('invalid email format shows error @regression', () => {
    cy.get('[role="textbox"][aria-label="Email"]').type('not-an-email');
    cy.contains('button', 'Register').click();
    cy.contains('valid email').should('be.visible');
  });

  it('valid data creates account @smoke', () => {
    const user = UserFactory.create();
    cy.get('[role="textbox"][aria-label="Email"]').type(user.email);
    cy.get('[role="textbox"][aria-label="Password"]').type(user.password);
    cy.contains('button', 'Register').click();
    cy.contains('Account created').should('be.visible');
  });
});
```

**Assertion pattern**: `.should('be.visible')` — auto-retries until timeout. No explicit wait needed.

## WebdriverIO (TypeScript)

```typescript
describe('Registration Form', () => {
  it('required fields show errors when empty @smoke', async () => {
    await browser.url('/register');
    await $('button=Register').click();

    const error = $('[role="alert"]');
    await expect(error).toBeDisplayed();
    await expect(error).toHaveTextContaining('Email is required');
  });

  it('invalid email format shows error @regression', async () => {
    await browser.url('/register');
    await $('input[aria-label="Email"]').setValue('not-an-email');
    await $('button=Register').click();

    const error = $('[role="alert"]');
    await expect(error).toBeDisplayed();
    await expect(error).toHaveTextContaining('valid email');
  });

  it('valid data creates account @smoke', async () => {
    const user = UserFactory.create();
    await browser.url('/register');
    await $('input[aria-label="Email"]').setValue(user.email);
    await $('input[aria-label="Password"]').setValue(user.password);
    await $('button=Register').click();

    await expect($('.success-message')).toBeDisplayed();
    await expect($('.success-message')).toHaveTextContaining('Account created');
  });
});
```

**Wait pattern**: `await expect(element).toBeDisplayed()` — auto-waits for element to exist and be visible.
