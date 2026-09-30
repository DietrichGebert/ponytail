# Vision Estates

A Next.js seller portal and NestJS/PostgreSQL workspace, with an independent navy-and-lime visual design and the seller workflow reviewed against the 32-page Engineering Blueprint v3.

**Status: local implementation and integration foundation. Not approved for production.** The public journey now supports German by default and English, separate double opt-in newsletter consent, and a broker-gated two-tier report experience. Licensed valuation, AI, calendar, actual email delivery, account recovery, data-protection workflows and production infrastructure still require the work in [the current Blueprint v3 audit](docs/BLUEPRINT-V3-IMPLEMENTATION.md). Integration gateway contracts are implemented; direct PriceHubble/Sprengnetter/Google/Microsoft vendor adapters are not.

## Start locally

1. Use Node.js 24 and a separate PostgreSQL database. If Docker is installed, `docker compose up -d db` starts the local database described in `compose.yaml`.
2. In `backend`, run `npm ci`. Create local configuration from `.env.example` **only if no .env exists**. The supplied .env has been preserved. Never point tests or first-time migrations at an unidentified client database.
3. Follow [database migration instructions](backend/prisma/migrations/README.md). Empty local database: `npm run db:migrate`. Existing database: verify and baseline before migrating; never reset client data.
4. Configure a private random `AUTH_JWT_SECRET` of at least 32 characters. Set bootstrap administrator email/password in the local environment, then run `npm run admin:create` only when the first admin does not exist. There are no default production logins. Remove those bootstrap variables afterwards.
5. In `backend`, run `npm run build`, then `npm run start:prod`. This reads .env and listens on 127.0.0.1:3001.
6. In `frontend`, run `npm ci`, set `API_INTERNAL_URL=http://127.0.0.1:3001` in .env.local, and run `npm run dev`. Open http://localhost:3000.
7. Sign in at /broker/login. The administrator can invite brokers from /admin; invited brokers verify their email and set a password at /broker/signup. Email delivery requires a configured transactional gateway and HTTPS public origin. See [onboarding](docs/BROKER-ONBOARDING.md). Brokers see only assigned leads.

The active frontend runs on http://localhost:3000. The previous port 3100 preview is stopped. On 12 September the supplied database was backed up and upgraded with approval; final schema comparison, API readiness and a rolled-back assessment service verification passed. See [database diagnosis and resolution](docs/DATABASE-DIAGNOSIS.md).

After configuring both applications, run `npm run dev` from the workspace root to start frontend port 3000 and backend port 3001 together. Backend development loads its existing .env. If the database is unavailable, the API remains alive, readiness returns 503, and database-dependent requests return a safe service error.

## Implemented application sequence

Seller homepage → validated four-step intake → transactional property/lead/consent creation → durable pending valuation state → configured integration gateway → provider-attributed report → scored broker pipeline → broker review and full-report release → calendar-backed booking request → confirmed appointment only after calendar success → queued confirmation email.

Without a valuation gateway, submissions stay pending and show no invented price. Without calendar configuration, online booking is unavailable. Missing email configuration never produces a claim that an email was sent.

## Checks

API contracts: after installing backend and frontend dependencies, run `npm run contract:generate` in backend to regenerate [OpenAPI](docs/openapi.json) and frontend types. `npm run contract:check` checks committed artifacts after a backend build. These commands run offline without starting workers or connecting to the database. Local read-only API documentation: http://127.0.0.1:3001/docs. Production documentation requires API_DOCS_ENABLED=true. See [implementation progress](docs/IMPLEMENTATION-PROGRESS.md) for completed batches and remaining work.

- Backend: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.
- Frontend: `npm run build`, `npm run lint`.
- The current API tests use an isolated mocked database adapter. They are not a substitute for PostgreSQL migration/concurrency tests or live vendor tests.
- CI configuration is provided; no repository, remote push or CI run was created in this workspace.

See [review and delivery sequence](docs/REVIEW-AND-ROADMAP.md), [API guide](docs/API.md), [integration contracts](docs/INTEGRATIONS.md), and [operations guide](docs/OPERATIONS.md).

