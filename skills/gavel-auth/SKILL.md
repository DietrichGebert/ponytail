---
name: gavel-auth
description: >
  Multi-tenant firm-scoped authentication for API and UI tests. Use when tests
  get 401 across tenants, need tenant-scoped tokens, or debug firm-scope
  mismatches. Framework-adaptive.
---

# Gavel Auth

Multi-tenant authentication for tests.

## When to Use

- Tests get 401 Unauthorized across tenants
- Need tenant-scoped tokens or session cookies
- Debugging firm-scope mismatches
- Setting up multi-tenant test fixtures

## Core Concepts

1. **Tenant isolation**: Each tenant has its own data scope. Tokens are scoped to a tenant.
2. **Host-based routing**: Multi-tenant apps often use subdomains (tenant1.app.com) or headers (X-Prop-Firm).
3. **Token scoping**: A token from tenant A cannot access tenant B's resources.

## Patterns

### API Auth (Playwright)
```typescript
// Fixture: login as tenant-specific user
test.extend<{ tenantAUser: APIRequestContext }>({
  tenantAUser: async ({}, use) => {
    const response = await request.post('/api/auth/login', {
      data: { email: UserFactory.create('tenantA').email, password: env.PASSWORD },
      headers: { 'X-Prop-Firm': 'tenant-a' },
    });
    await use(response);
  },
});
```

### UI Auth (Playwright)
```typescript
// Navigate via tenant-specific subdomain
await page.goto(`http://tenant-a.localhost:${port}/login`);
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 on cross-tenant request | Token scoped to wrong tenant | Use correct tenant's credentials |
| 404 instead of 403 | App returns 404 for scope mismatch | Expected behavior for security |
| Session expired | Token TTL exceeded | Re-login in beforeEach |
