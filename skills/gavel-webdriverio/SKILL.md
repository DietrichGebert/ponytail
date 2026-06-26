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

## Assertions (built-in wait)

```typescript
await expect($('[role="alert"]')).toBeDisplayed();
await expect($('[role="alert"]')).toHaveText('Success');
await expect($('input')).toBeEnabled();
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
class AdminDashboardPage {
  async open() { await browser.url('/admin/dashboard'); }
  get metricsCard() { return $('[data-testid="metrics"]'); }
  async navigateTo(section: string) {
    await $('[role="navigation"]').$(section).click();
  }
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
