---
name: gavel-ci
description: >
  Run automation on cloud infrastructure (OCI, GitHub Actions, GitLab CI, etc.).
  Use for CI migration, nightly test runs, or when asked about cloud vs local
  test execution.
---

# Gavel CI

Cloud CI automation runner.

## When to Use

- Setting up CI pipelines for test automation
- Migrating tests from local to cloud execution
- Nightly/weekly automated test runs
- Comparing cloud vs local test execution

## Supported CI Systems

| CI | Config File | Notes |
|----|-------------|-------|
| GitHub Actions | `.github/workflows/*.yml` | Most common for open-source |
| GitLab CI | `.gitlab-ci.yml` | Good for monorepos |
| Jenkins | `Jenkinsfile` | Enterprise standard |
| Azure DevOps | `azure-pipelines.yml` | Microsoft ecosystem |
| CircleCI | `.circleci/config.yml` | Fast parallel execution |
| Oracle Cloud (OCI) | Custom scripts | Always Free tier available |

## General CI Pattern

```yaml
# GitHub Actions example
name: Test Automation
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
```

## Best Practices

1. Cache dependencies (node_modules, Playwright browsers)
2. Run smoke tests on PR, full suite on merge to main
3. Upload test reports as artifacts
4. Use matrix strategy for multi-browser testing
5. Set appropriate timeouts (tests should complete in < 30 min)
