# Backend

NestJS / Prisma API for Vision Estates. Follow the [root setup guide](../README.md) and [migration instructions](prisma/migrations/README.md) before running against a database.

Default API: http://127.0.0.1:3001/v1. Build with `npm run build`, start with `npm run start:prod` (loads .env), and create the first administrator with `npm run admin:create` after configuring bootstrap variables.

Checks: `npm run lint`, `npm test`, `npm run test:e2e`. API tests use an isolated mocked persistence adapter, not the client database.

See [review status](../docs/REVIEW-AND-ROADMAP.md) and [integration contracts](../docs/INTEGRATIONS.md). Production acceptance is not complete.
