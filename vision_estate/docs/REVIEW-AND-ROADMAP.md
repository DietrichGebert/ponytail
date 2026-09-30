# Proposal review and implementation status

Reviewed source: “Vision Estates - AI Seller Acquisition Platform - Technical Proposal (1).pdf”, version 1.0, 30 pages, supplied by the user. UI reference: https://comfy-unicorn-2bce7a.netlify.app/. The document is a requirements reference, not authorization to accept agreements, contact people or deploy infrastructure.

## Findings in the supplied application

| Finding | Change |
| --- | --- |
| Homepage was the Next.js starter page; intake/dashboard used an unrelated dark theme | Shared cream/forest-green visual system, editorial homepage, responsive four-step intake, report, login, broker and admin screens |
| Valuation calculated area × €6,200 and claimed PriceHubble provenance | Removed fabricated valuation logic. Only schema-validated integration data may create new valuations |
| Every lead defaulted to HOT | Deterministic scoring, version and individual contributing reasons |
| Broker endpoints exposed leads and allowed review/release without authentication | HttpOnly sessions, active-account checks, broker/admin guards and assignment checks |
| Report endpoints allowed reads by property ID alone | Per-assessment secret header checked against a server-side SHA-256 hash |
| Hard-coded broker_mario attribution | Authenticated actor IDs and transactional audit entries |
| Nested fields, email, enum/range constraints and consent were insufficiently validated | Nested DTO validation, defined inputs, numeric limits, enum validation and mandatory processing consent |
| Step 1 could be skipped without native form validation | Each visible step submits a real validated HTML form |
| Idempotency headers were ignored | Unique persisted submission keys with body/token matching and conflict handling |
| In-process event emission could lose valuation work on restart | Persisted pending work with bounded worker batches and restart recovery |
| Seller report fetched once and hid errors | Bounded polling, private-access errors, explicit provider-pending state and manual refresh |
| CORS reflected any origin; frontend API used a hard-coded localhost port | Same-origin Next.js proxy, server-only API URL, allowlisted backend origins and separate ports |
| Newsletter code logged email confirmation tokens without delivering them | Removed token logging and disabled new newsletter enrollment; existing records preserved |
| No booking model, admin accounts, notification queue or migration history | Added schema, core operations, setup scripts, migrations and delivery worker boundaries |
| Production start script pointed to the wrong compiled path | Fixed to dist/src/main.js |
| Template tests did not inject required dependencies | Added behavioral tests for scoring, validation, ownership, roles, release and idempotency |

## What is implemented versus still open

| Proposal requirement | Status / remaining work |
| --- | --- |
| Seller portal and property intake | Implemented in English; German localization remains open. Land currently uses the shared year/condition fields and needs a dedicated provider-specific schema during discovery |
| Reference visual flow | Implemented; reference testimonials, magazine endorsements and example monetary values were not represented as genuine company claims |
| Licensed valuation | Fabricated values removed; HTTPS gateway boundary and output validation implemented. **Actual licensed vendor adapter/account is not connected** |
| AI narration | Gateway explanation validation and factual fallback implemented. **Direct OpenAI/Anthropic adapters, versioned prompt loading and grounded-language evaluation remain open** |
| Lead scoring | Implemented v1; client must confirm weights/value bands. Admin displays rules; runtime rule editing is not implemented |
| Broker pipeline/detail/review/release | Implemented, with assignment-based access and audit records |
| Admin team management | Account creation, activation/deactivation, assignment, queue/configuration overview and recent audit records implemented |
| Seller identity | Browser-session ownership token implemented. **Email verification, sign-in and cross-device recovery are not implemented** |
| Broker auth | Revocable PostgreSQL sessions, scrypt password hashes. **This differs from proposed JWT rotation and Argon2id/bcrypt**; record/resolve the architecture decision before production. Password recovery, forced first-login change, MFA and per-account lockout are open |
| Booking | Local availability, overlap checks, serializable reservation, unique slot claim and pending/confirmed status implemented. **Vendor free/busy sync, cancellation/rescheduling and reconciliation UI remain open** |
| Notifications | Persisted queue, bounded attempts, idempotency headers and visible failure state implemented. **Email delivery gateway/domain authentication is not connected** |
| Report PDF | Browser print/save-as-PDF implemented. **Server-generated branded PDFs, S3 storage and authorized sharing links remain open** |
| Maps | German postal-format validation only. **Geocoding and actual address verification remain open** |
| Audit | Key application events appended transactionally. **Database-enforced append-only permissions, seller reads/exports coverage and retention policy remain open** |
| Data protection | Consent record and access controls implemented. **Client-approved privacy notice, lawful-basis review, export/erasure workflow, retention automation and field-level PII encryption remain open** |
| Database | Additive migration files generated; legacy data quarantined without deletion. **Migrations have not run against the supplied database** |
| Infrastructure | Dockerfiles, local PostgreSQL compose, CI checks and runbook scaffold provided. **Docker build, AWS provisioning, TLS/HSTS, secrets manager, backups/restores, blue-green deploy and rollback rehearsal remain unverified/unimplemented** |
| Performance/observability | Pagination, timeouts, durable pending work, health checks and request IDs. **Redis cache/limiter, OpenTelemetry, metrics/alerts and load testing remain open** |
| Reserved Documents model | Not added; remains a proposal gap for the future module |
| Testing | Unit/API checks and desktop/mobile public-flow inspection. **Real PostgreSQL concurrency tests, complete authenticated browser journeys, accessibility audit, load testing, vendor staging tests and client UAT remain open** |
| OpenAPI | Human-readable route guide supplied. **Auto-generated typed OpenAPI contract is still required** |

## Delivery sequence matching proposal §15

1. **Discovery:** select PriceHubble or Sprengnetter; confirm Google Calendar or Microsoft 365; confirm German/English wording, provider coverage (including land), scoring weights, report release policy and legal/privacy content.
2. **Architecture:** resolve the documented identity/password deviations, finalize typed API contracts, provider request mapping, privacy/export/erasure rules and data-retention periods.
3. **Infrastructure:** set up isolated local/staging/production resources in the client account; configure EU hosting, secrets, encrypted storage, migrations and backup policies.
4. **Backend:** apply and test migrations on a disposable database and backup clone; bootstrap admin; assign brokers; finish account recovery, audit coverage and privacy operations.
5. **Frontend:** review the supplied design preview; complete German localization and authenticated broker/admin/report UAT using a real isolated backend.
6. **AI:** implement interchangeable real providers, versioned prompt configuration and output evaluation, with valuation numbers immutable from the licensed source.
7. **Integrations:** implement and test the selected licensed provider adapter, geocoding, real calendar free/busy/write/sync and email transport. Follow INTEGRATIONS.md.
8. **Testing:** exercise the full seller-to-booking journey, simultaneous reservations, duplicate requests, provider failures, browser reloads, recovery and permission boundaries.
9. **Deployment:** build containers, run staging CI, configure health-gated blue-green promotion and rehearse rollback plus database restore.
10. **Launch:** close the outstanding security/privacy checks and obtain client sign-off against PDF Appendix E before customer access.
11. **Support:** establish monitoring, incident ownership, dependency updates, backup restore cadence and an agreed support SLA.

This work is a substantial implementation pass, **not completion of the PDF's production acceptance criteria**. No live client database was reset, no external messages were sent, and no public deployment was made.

