---
name: gavel-webdriverio
description: >
  WebdriverIO framework profile for gavel. Provides WebdriverIO-specific
  patterns: waitForDisplayed(), service objects, browser.call(), $() with
  semantic selectors. Activated automatically by gavel-detect.
---

# Gavel WebdriverIO Profile

WebdriverIO-specific patterns that supplement the universal Test Constitution.

## Locators

```typescript
// PRIORITY ORDER:
$('[role="button"]=Submit')                     // semantic + text
$('aria/Email')                                  // accessibility
$('[data-testid="submit-btn"]')                  // testid (last resort)
// NEVER: $('.btn-primary') or $('div > span')
```

## Selector Boundary

Only locator getters may call `$`, `$$`, `element.$`, or `element.$$`. Actions/pages/specs call named locator getters only; nested/dynamic elements become named getters or methods such as `navItem(section)`.

## Assertions (built-in wait)

```typescript
await expect(locators.alert).toBeDisplayed();
await expect(locators.alert).toHaveText('Success');
await expect(locators.emailInput).toBeEnabled();
await expect(browser).toHaveUrl(/\/dashboard/);
```

## DI via browser.call() / before Hook

```typescript
// wdio.conf.ts
before: async function() {
  browser.addCommand('adminDashboard', () => new AdminDashboardPage());
}

// specs: use browser.adminDashboard(), never new AdminDashboardPage() in test
```

## POM: Service Objects

```typescript
class AdminDashboardLocators {
  get metricsCard() { return $('[data-testid="metrics"]'); }
  navItem(section: string) { return $(`[role="navigation"]=${section}`); }
}

class AdminDashboardPage {
  locators = new AdminDashboardLocators();
  async open() { await browser.url('/admin/dashboard'); }
  get metricsCard() { return this.locators.metricsCard; }
  async navigateTo(section: string) { await this.locators.navItem(section).click(); }
}
```

## Wait Strategy

NEVER use `browser.pause(2000)`. Use:
```typescript
await element.waitForDisplayed({ timeout: 10000 });
await browser.waitUntil(async () => (await element.getText()) === 'Done');
```

## Run Commands

```bash
npx tsc --noEmit && npx eslint .                # Type + lint
npx wdio run wdio.conf.ts                       # Run all
npx wdio run wdio.conf.ts --spec dashboard      # Specific spec
```
