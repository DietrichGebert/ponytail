---
name: gavel-api
description: >
  API test scenarios for any backend. Service layer pattern, auth, multi-tenant
  headers, contract validation. Framework-adaptive. Use when asked to write API
  tests, validate endpoints, test authentication, or verify API contracts.
---

# Gavel API

API test authoring workflow. Framework-adaptive via active profile.

## When to Use

- Create new API tests for any endpoint
- Validate request/response contracts
- Test authentication and authorization scenarios
- Verify error handling and edge cases
- Test multi-tenant isolation
- Test pagination and filtering

## Workflow

### Step 1: Identify the Endpoint

Check if a service class exists for the endpoint domain. If not, create one.

### Step 2: Create/Update Service

Service classes encapsulate HTTP calls. Define methods: create, list, retrieve, update, delete. Use typed responses.

### Step 3: Write the Test

Use fixture DI for services. Use factories for test data. Group with test.step().

### Step 4: Run and Validate

Type-check, lint, run the test. Verify pass.

### Step 5: Verify Coverage

Each endpoint needs: happy path (200/201), validation (400), auth (401), authZ (403), edge cases.

## Common Service Methods

| Method | HTTP | Usage |
|--------|------|-------|
| `createX({ data })` | POST | Create resource |
| `listX({ params? })` | GET | List (paginated) |
| `retrieveX(id)` | GET | Get single |
| `updateX(id, { data })` | PUT/PATCH | Update |
| `deleteX(id)` | DELETE | Delete |

## Contract Validation (2026 standard)

Every API response must match a schema. Schema drift is the #1 cause of silent prod bugs. Validate on every test.

### OpenAPI / JSON Schema (Playwright + ajv)

```typescript
import Ajv from 'ajv';
const ajv = new Ajv({ strict: false });

// Define or import the schema from your OpenAPI spec:
const userSchema = {
  type: 'object',
  required: ['id', 'email', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};

test('GET /api/users/123 returns valid schema', async ({ request }) => {
  const response = await request.get('/api/users/123');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(ajv.validate(userSchema, body)).toBe(true); // hard gate
});
```

### Schema Source Priority

1. **OpenAPI spec** in the repo (`openapi.yaml`) — import once, share across all API tests
2. **Zod / TypeBox** runtime schemas — colocated with the service layer
3. **Inline JSON Schema** — last resort, only for one-off endpoints

### When Mocking is OK

Mocking is acceptable only for: external paid APIs, payment gateways, third-party services you don't control. Never mock your own backend; hit the real one (staging env, isolated DB). A test that mocks your own API tests your mock, not your code.

## Coverage Requirements

API tests must cover, per endpoint:
- Happy path (200 / 201)
- Validation error (400) — at least one required-field test
- Auth missing (401)
- AuthZ denied (403) — if endpoint has permission checks
- Tenant isolation (403 / 404) — for multi-tenant APIs

That's the minimum. Negative edge cases (boundary inputs, malformed bodies) belong in unit tests, not here.
