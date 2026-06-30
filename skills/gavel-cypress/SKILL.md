---
name: gavel-cypress
description: >
  Cypress framework profile for gavel. Provides Cypress-specific patterns:
  auto-retry assertions, custom commands, beforeEach setup, cy.get() with
  semantic selectors. Activated automatically by gavel-detect.
---

# Gavel Cypress Profile

Cypress-specific patterns that supplement the universal Test Constitution.

## Locators

```javascript
// PRIORITY ORDER:
cy.get('[role="button"]').contains('Submit')    // semantic + text
cy.get('[aria-label="Email"]')                  // labeled control
cy.get('[data-testid="submit-btn"]')            // testid (last resort)
// NEVER: cy.get('.btn-primary') or cy.get('div > span')
```

## Selector Boundary

Selectors belong in custom commands or locator helpers, not specs/actions. Do not hide raw selectors in chains like `.find('...')`, `.closest('...')`, `.filter('...')`, or `cy.contains(selector, text)` outside that locator boundary.

## Assertions (auto-retry, built-in)

```javascript
cy.get('[role="alert"]').should('be.visible');
cy.get('[role="alert"]').should('contain.text', 'Success');
cy.get('input').should('be.enabled');
cy.url().should('include', '/dashboard');
cy.intercept('POST', '/api/data').as('postData');
cy.wait('@postData').its('response.statusCode').should('eq', 200);
```

## DI via beforeEach / Custom Commands

```javascript
// support/commands.js
Cypress.Commands.add('loginAsAdmin', () => {
  cy.request('POST', '/api/auth/login', { /* credentials from env */ });
});

// Custom page object via commands
Cypress.Commands.add('adminDashboard', () => {
  return new AdminDashboardPage();
});

// specs: use commands, never instantiate in test body
```

## POM: Custom Commands + Service Objects

```javascript
// pages/AdminDashboardPage.js
const dashboardLocators = {
  metricsCard: () => cy.get('[data-testid="metrics"]'),
  navItem: (section) => cy.contains('[role="navigation"] a', section),
};

export class AdminDashboardPage {
  visit() { cy.visit('/admin/dashboard'); }
  get metricsCard() { return dashboardLocators.metricsCard(); }
  navigateTo(section) { dashboardLocators.navItem(section).click(); }
}
```

## Wait Strategy

Cypress auto-retries assertions. NEVER use `cy.wait(2000)`. Use:
```javascript
cy.get('[role="status"]').should('not.exist'); // wait for loading to disappear
cy.intercept('GET', '/api/data').as('data');
cy.wait('@data');                               // wait for specific network call
```

## Run Commands

```bash
npx eslint .                                    # Linting
npx cypress run --browser chrome                # Run headless
npx cypress open                                # Interactive mode
npx cypress run --spec "cypress/e2e/dashboard.cy.js"  # Specific spec
```
