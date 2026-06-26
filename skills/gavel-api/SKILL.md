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
