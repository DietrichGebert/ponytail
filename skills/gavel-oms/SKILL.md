---
name: gavel-oms
description: >
  Order Management System / account lifecycle local testing. Use when testing
  account creation, trading flows, or OMS-specific features that require special
  environment setup.
---

# Gavel OMS

OMS/account lifecycle testing.

## When to Use

- Testing account creation and lifecycle (create, activate, trade, close)
- OMS-specific features that need special setup
- Trading UI tests that depend on OMS backend

## Setup

1. Ensure OMS backend service is running
2. Verify test accounts exist in the system
3. Check that trading endpoints are accessible

## Common Patterns

- Account lifecycle: create -> fund -> trade -> close
- Some tests may expect-fail if the trading frontend is not available
- Use `test.fail()` with a reference to the missing dependency

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OMS not running | Start OMS service first |
| Account not found | Seed test accounts |
| Trading UI errors | Check if trading frontend is deployed |
