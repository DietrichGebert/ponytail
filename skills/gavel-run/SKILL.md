---
name: gavel-run
description: >
  Configure and run tests for any framework. Trace viewer, project setup,
  report analysis. Framework-adaptive. Use when asked to configure test runners,
  run local tests, debug using traces, or test multi-project configurations.
---

# Gavel Run

Test execution and configuration. Framework-adaptive via active profile.

## When to Use

- Configure Playwright, Selenium, Cypress, or WebdriverIO for a project
- Run tests locally with proper project settings
- Debug using trace viewer or screenshots
- Set up multi-project browser configurations

## General Run Pattern

1. Verify env: backend running, DB seeded, correct URLs
2. Type-check + lint before running
3. Run targeted test first, then expand
4. Use trace/report viewer for failures

## Per-Framework Quick Start

See the active framework profile (`gavel-playwright`, `gavel-selenium`, etc.) for exact commands.

## Debugging

- **Trace viewer**: Playwright `npx playwright show-report`, Cypress dashboard
- **Screenshots**: auto-captured on failure in most frameworks
- **Video**: Playwright `video: 'on-first-retry'`, Cypress `video: true`
- **Console logs**: captured in test reports
