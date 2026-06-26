---
name: gavel-env
description: >
  Start and verify the local testing environment. Seed databases, start servers,
  verify services are available. Framework-adaptive. Use when asked to run manual
  testing, seed the database, start/stop servers, or troubleshoot local
  availability before test runs.
---

# Gavel Env

Local environment setup and verification.

## When to Use

- Before running any test suite locally
- When tests fail with connection errors
- When setting up a new developer's environment
- Pre-flight before Playwright/Selenium runs

## General Pre-Flight Checklist

1. **Backend running?** -- check health endpoint (e.g., `curl localhost:8000/health`)
2. **Database seeded?** -- verify test users/data exist
3. **Frontend running?** -- check UI URL loads
4. **Correct env vars?** -- verify .env files have correct URLs/credentials
5. **Ports available?** -- no conflicts on expected ports

## Per-Stack Quick Reference

### Django/Python
```bash
python manage.py migrate && python manage.py seed_db && python manage.py runserver
```

### Node/Express/Next.js
```bash
npm run dev  # or npm start
```

### Java/Spring
```bash
mvn spring-boot:run
```

## Verification

After starting, verify each service:
```bash
curl -s http://localhost:<port>/health | head -1
```

If any service is down, fix before running tests.
