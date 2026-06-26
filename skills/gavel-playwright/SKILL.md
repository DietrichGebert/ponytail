---
name: gavel-playwright
description: >
  Playwright framework profile for gavel. Provides Playwright-specific patterns:
  web-first assertions, test.step(), fixture DI, mixin POM, getByRole locators.
  Activated automatically by gavel-detect when Playwright is detected.
---

# Gavel Playwright Profile

Playwright-specific patterns that supplement the universal Test Constitution.

## Locators

```typescript
// PRIORITY ORDER:
page.getByRole('button', { name: 'Submit' })        // 1st: semantic
page.getByLabel('Email')                              // 2nd: form labels
page.getByPlaceholder('Enter email')                  // 3rd: placeholders
page.getByText('Welcome')                             // 4th: text content
page.getByTestId('submit-btn')                        // 5th: testid (last resort)
// NEVER: page.locator('.btn') or page.locator('//div')
```

## Assertions (web-first, auto-retrying)

```typescript
await expect(locator).toBeVisible();
await expect(locator).toHaveText('Success');
await expect(locator).toBeEnabled();
await expect(page).toHaveURL(/\/dashboard/);
await expect(response).toBeOK();          // API responses
await expect(response).toBeApiError(400); // API errors
```

## DI via Fixtures

```typescript
// fixtures/adminFixtures.ts
import { test as base } from '@playwright/test';
export const test = base.extend<{ adminPage: AdminPage }>({
  adminPage: async ({ page }, use) => {
    const adminPage = new AdminPage(page); // only in fixtures, never in specs
    await adminPage.login();
    await use(adminPage);
  },
});

// specs: use { adminPage } from fixtures, never new AdminPage(page)
```

## POM: Mixin Composition

```typescript
// Mixin: reusable behavior
export function SidebarNav<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base {
    async navigateTo(item: string) { /* ... */ }
  };
}

// Page object: compose mixins
export class AdminDashboardPage extends SidebarNav(LocatorMixin(AdminBasePage)) {}
```

## Logical Grouping

```typescript
await test.step('Navigate to dashboard', async () => {
  await adminPage.navigateTo('/dashboard');
});
await test.step('Verify metrics load', async () => {
  await expect(adminPage.locators.metricsCard).toBeVisible();
});
```

## Wait Strategy

NEVER use `waitForTimeout()` or `networkidle`. Playwright's web-first assertions
auto-retry. For custom waits:
```typescript
await page.waitForResponse(resp => resp.url().includes('/api/data'));
await locator.waitFor({ state: 'visible' });
```

## Run Commands

```bash
npx tsc --noEmit                          # TypeScript check
npx eslint .                              # Linting
npx playwright test --project=chromium    # Run tests
npx playwright test -g "TBADM-42"        # Run specific test
npx playwright show-report               # View report
```

## Tags

| Tag | Purpose |
|-----|---------|
| `@smoke` | Fastest critical-path checks |
| `@sanity` | Important feature verification |
| `@regression` | Broader coverage |
| `@integration` | Cross-surface user journeys |
| `@prod` | Read-only, non-mutating tests |
