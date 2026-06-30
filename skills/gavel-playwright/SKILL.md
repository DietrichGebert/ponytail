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

## Selector Boundary

Only locator classes may create or refine element targets. Actions/pages/specs must not call `locator.locator('...')`, `page.$`, `$eval`, `evaluate()` with `querySelector(All)`, `closest`, or `matches`. Expose nested/dynamic targets as named locators such as `deleteButtonForRow(name)`.

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
| `@flaky:env` | Quarantined: environment-dependent flakiness |
| `@flaky:data` | Quarantined: data/seed-dependent flakiness |
| `@flaky:ui` | Quarantined: DOM/animation-dependent flakiness |

## 2026 Native Features

Use these instead of third-party tools where possible.

### Accessibility (`toMatchAriaSnapshot`)

```typescript
// Built-in ARIA snapshot assertion. No axe-core dependency for the common cases.
await expect(locators.main).toMatchAriaSnapshot(`
  - heading "Dashboard"
  - button "Refresh"
`);

// For deeper WCAG audits, pair with @axe-core/playwright:
import AxeBuilder from '@axe-core/playwright';
await new AxeBuilder({ page }).analyze(); // run after expect.toPass()
```

### Visual Regression (`toHaveScreenshot`)

```typescript
// First run captures, subsequent runs compare.
await expect(page).toHaveScreenshot('dashboard.png', { maxDiffPixels: 100 });

// Element-only visual diff (use sparingly; full-page is usually right):
await expect(locators.nav).toHaveScreenshot('navbar.png');

// Mask dynamic regions so the diff focuses on what changed:
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [locators.timestamp],
});
```

### Component Testing (no server)

```typescript
// Mount components in isolation, no backend needed.
import { test, expect } from '@playwright/experimental-ct-react';
test('button renders label', async ({ mount }) => {
  const component = await mount(<Button label="Submit" />);
  await expect(component.getByRole('button', { name: 'Submit' })).toBeVisible();
});
```

### API Testing (`request` fixture, no browser)

```typescript
test('GET /api/users returns list', async ({ request }) => {
  const response = await request.get('/api/users');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchSchema(usersSchema); // contract check
});
```

### Polling & Retry (`expect.toPass`, `expect.poll`)

```typescript
// Poll a condition until it passes (or times out). Replaces flaky wait loops.
await expect(async () => {
  const status = await page.evaluate(() => fetch('/health').then(r => r.status));
  expect(status).toBe(200);
}).toPass({ timeout: 10_000, intervals: [500, 1000, 2000] });

// Poll a value (use when a polling API exists, prefer toPass for actions).
await expect.poll(async () => {
  return await page.evaluate(() => document.title);
}).toBe('Dashboard');
```

### Trace & Annotations

```typescript
test('critical user flow', async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: 'ticket', description: 'TBADM-42' });
  // Trace is auto-captured on failure. Force-capture on pass for hard flows:
  await testInfo.attach('trace-summary', {
    body: await page.evaluate(() => performance.timing.toJSON()),
    contentType: 'application/json',
  });
});
```
