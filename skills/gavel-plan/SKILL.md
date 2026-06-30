---
name: gavel-plan
description: >
  ISTQB-aligned test planning for any project. Analyze repos and merges, design
  API/UI scenarios, produce executable MD test plans, run tests, and output
  test-case specs. Framework-adaptive. Use for test plans, coverage gaps,
  QA strategy, merge analysis, or executing plan MD files.
---

# Gavel Plan

Canonical planning skill. Works across all frameworks and languages.

## When to Use

- Create test plans for new features or bug fixes
- Analyze coverage gaps across backend, API, and UI repos
- Inspect merges and map changes to test areas
- Execute an MD test plan and record results
- Produce "Test Cases to Create" for downstream agents

## Planning Charter

1. Explore the live app before writing scenarios -- no guessing at DOM or API shapes
2. All scenarios must be independent (no shared state, no execution order)
3. Include happy path, edge cases, and error/negative scenarios
4. Write steps specific enough for any tester to follow
5. Assume blank/fresh app state at start of each scenario
6. Every scenario represents a real user flow, not implementation details
7. Do not proceed to test generation without a completed plan

## Scenario Categories

| Category | API | UI |
|----------|-----|-----|
| Happy path | 200/201 | Visible success state |
| Validation | 400 + error details | Error messages visible |
| Auth | 401 | Redirect to login |
| AuthZ | 403 | Disabled/hidden elements |
| Multi-tenant | Per-tenant headers | Tenant-specific data |
| Edge cases | Pagination, empty, boundary | Empty states, loading |

## Downstream Handoffs

| After this skill | Invoke |
|------------------|--------|
| Plan complete, need API tests | `gavel-api-specialist` agent + `gavel-api` skill |
| Plan complete, need UI tests | `gavel-generator` agent + `gavel-e2e` skill |
| Suite run complete, need failure analysis | `gavel-analyze` skill |
| Env not ready before run | `gavel-env` skill |

## Test Plan Output

Required sections: Scope Summary, Manual Test Cases, Automation Check, Run Commands, Dependencies, Bug Drafts (optional). Plans must be agent-executable.

## Coverage Checklist

- [ ] Happy path covers main success flow
- [ ] Validation covers required fields
- [ ] Error scenarios (4xx, 5xx)
- [ ] Auth and AuthZ scenarios
- [ ] Multi-tenant isolation (if applicable)
- [ ] Pagination (if applicable)
- [ ] Tests independent; clear pass criteria
