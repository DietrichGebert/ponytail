# Implementation progress

## Error review — 22 September 2026

Closed the interrupted database service regression and schema-diff check (no drift). Fixed authentication/deactivation races, quarantined legacy valuation exposure, incomplete calendar-configuration handling and false-success retry responses. Restored the stopped backend. Verification: 107 unit tests, 16 API tests, backend/frontend builds and lint, contract checks, real PostgreSQL auth regression and zero known npm audit vulnerabilities. The live provider gateways are not configured. No production deployment or complete-blueprint claim is made; see VERIFICATION.md and the requirement audit.

## Blueprint v3 continuation — 21 September 2026

Delivered JWT access/refresh rotation/reuse revocation with compatible legacy sessions; verified admin-invited broker onboarding with signup/password setup and invitation reissue/revoke; database report-release/review invariants and append-only consent/audit triggers; valuation-linked new report rows; scoped consent history, staff/audit/property cursor lists and stored valuation reads. Contracts now cover 39 operations. Three additive migrations were rehearsed and applied without deleting existing records. See [broker onboarding](BROKER-ONBOARDING.md) and the [updated requirement register](BLUEPRINT-V3-IMPLEMENTATION.md).

Real PostgreSQL rollback checks verified refresh-family revocation and a synthetic invited broker's verification, login, review/release, duplicate-notification prevention and consent access. No messages/provider calls were sent. Final build/test and browser evidence is recorded in VERIFICATION.md. All earlier progress entries below are historical; their auth/schema/endpoint gaps may have been superseded by this continuation. Remaining development includes universal idempotency, other endpoint alignment/scoring/cancellation, seller identity/recovery, distributed jobs, direct provider adapters and production operations/UAT.

## Blueprint v3 revision — 20 September 2026

The supplied 32-page Engineering Blueprint v3 is now the primary requirements baseline. See [the section-by-section v3 audit](BLUEPRINT-V3-IMPLEMENTATION.md) for every implemented/partial/pending area and Appendix E acceptance evidence. Historical entries below are not current completion claims.

Delivered: independent architectural homepage; German-first/English public intake, seller progress/report workspace and newsletter pages; separately versioned server consent templates; optional newsletter capture with confirmation/replay protection/withdrawal/expiry and queued delivery; compact/full report field separation including legacy-row protection; distinct strategy validation and independent full-tier retry; report-ready/release notifications; 26-operation API contract and regenerated client types. Existing staff sessions and database schema preserved.

Validation: 60 unit tests and 9 isolated API tests, build/lint and contract checks are tracked in VERIFICATION.md. Real PostgreSQL rollback verification passed German-default intake, newsletter unticked/ticked flows, pending outbox, hashed token confirmation, replay denial, withdrawal and private report projection. No test record was retained and no provider request or message was sent. Public browser checks covered desktop/mobile, language switching with retained form data, property preselection, validation and separate unchecked consent fields.

Removed unused Nest Cloud deployment tooling carrying five dependency advisories; backend and frontend full dependency scans now report zero known vulnerabilities at scan time. Updated Vitest configurations to native ESM/path support. The local Node 24.14 tooling-engine warning remains; CI uses the current Node 24 line and local development should use Node 24.15 or newer compatible patch.

Not complete: real provider integrations, full auth/endpoint/schema alignment, database release trigger/immutable consent permissions, complete DE/EN provider/email acceptance, production infrastructure and client UAT. This revision must not be described as a client-ready production launch.

## Batch 2 — 15 September 2026

Implemented the next architecture and API contract batch while preserving the current UI and workflows.

- Admin, booking, property workflow, authentication and readiness controllers now delegate to services. ApplicationRepository provides typed persistence and transaction boundaries; LeadQueryRepository retains the authorized search implementation. Workers use the persistence boundary too.
- This is an incremental separation: service query arguments remain Prisma-shaped. Fully ORM-independent domain models and the final ERD remain follow-up work.
- All 23 current API operations are covered in `openapi.json`, derived from registered Nest routes with centrally maintained payload schemas. Coverage fails for undocumented routes. Cookie sessions and seller assessment-token headers describe the actual implementation.
- Read-only Swagger UI is available at http://127.0.0.1:3001/docs and JSON at /v1/openapi.json. Production requires API_DOCS_ENABLED=true to expose documentation.
- Frontend response models now consume generated OpenAPI types. Offline generation and CI drift checks require neither database access nor workers. Request-client generation is not yet universal.
- Explicit null values on non-null optional inputs are rejected; origin and throttling failures use problem-details responses. Missing report lead handling and administrative audit actor attribution are covered.

Validation: backend build/lint, 40 unit tests and 6 isolated API tests passed; frontend production build/lint/typecheck passed. OpenAPI parser validation, generated-artifact drift checks and representative DTO/schema agreement passed. Real PostgreSQL account creation, login, intake, assignment, booking reservation/retry and account-deactivation session revocation passed inside a rolled-back transaction. Synthetic records were removed by rollback and absence checked. No provider request or message was sent. No database migration was needed. This batch did not repeat authenticated visual browser verification.

Dependency maintenance: runtime npm audit reports zero vulnerabilities after the compatible platform-express update. Five development dependency advisories remain; the entire dependency tree is not security-cleared. Local Node 24.14 also produces a tooling engine warning requiring a newer Node 24 patch.

Next sequence: finalize the ERD and authentication migration design; implement JWT/refresh, password migration and account onboarding/recovery with compatibility and revocation tests; then continue proposal phase gates. Existing opaque sessions and scrypt remain active. Real valuation/calendar/email adapters, client UAT and production acceptance remain pending. Historical Batch 1 items below are superseded where explicitly completed here.

## Batch 1 — 14 September 2026

User requested execution of PROPOSAL-IMPLEMENTATION-PLAN.md. Existing navy/lime design and API ownership behavior are preserved.

### Step 1: discovery tracking — open

| Decision | Current position | Dependency |
| --- | --- | --- |
| Licensed valuation provider | Awaiting PriceHubble/Sprengnetter selection and access | Real valuation adapter and type coverage |
| Calendar | Awaiting Google/Microsoft selection and broker access | Free/busy and synchronization |
| Initial administrator | Awaiting client email/identity | Account setup; no default credentials |
| Scoring weights/report-release policy | Existing v1 is provisional | Versioned rules editor and signed acceptance cases |
| Hosting/AI/domain/languages/privacy/NFRs | Proposal remains baseline; operational decisions pending | Client staging, provider processing, copy and acceptance targets |

These do not block local architecture refactoring. They do block claiming discovery or real integrations complete. No provider, SLA, production region or client account was invented.

### Step 2: architecture — first vertical slice implemented

- Lead list now follows controller -> LeadQueryService -> LeadQueryRepository. Authorization stays in the service; SQL/Prisma queries and audit persistence stay in the repository.
- GET /v1/leads supports validated page, q and stage. Search is case-insensitive and treats punctuation literally. It runs over the authorized dataset before pagination.
- Broker assignment restriction is included in the database filter. Unknown/future seller roles are denied before repository access. Admin search remains broader by explicit policy.
- Count and page results use one repeatable-read transaction; stable createdAt/id ordering and page clamping avoid inconsistent totals and empty out-of-range pages.
- Search text is not copied into audit metadata. Property token hashes and submission keys are excluded from the response.
- Other controllers still need the same separation. JWT, password migration, OpenAPI and the final ERD are NOT completed by this batch.

### Related frontend improvement (plan FE09)

- Search submits to the backend; stage changes reset pagination. Matching totals now describe the filtered dataset.
- Aborted/stale effect requests cannot overwrite results after navigation or filter changes.
- Latest reports are ordered deterministically. A dedicated lead detail endpoint remains follow-up work.

### Existing regression repaired

The current PrismaService contained manual auditLog/valuation properties that shadowed generated Prisma accessors and caused TS2610 build failures. Removed those declarations and restored startup error handling so liveness can stay available while readiness fails during a database outage.

### Validation

Backend build passed; 33 unit tests and 6 isolated API tests passed; backend lint passed. Frontend production build passed; final loading-state adjustment checked with lint/typecheck. Real PostgreSQL verification passed: 52 synthetic records exercise cross-page/case-insensitive/literal search, broker isolation, stage totals, page clamping, admin scope and private-field exclusion. All synthetic properties/leads/audit writes were rolled back and absence verified. No external provider or notification was invoked. Authenticated visual browser verification of this updated screen remains pending; no client account was invented to perform it.

### Next implementation batches

1. Complete architecture contracts/ERD and remaining controller/service/repository separation; define the JWT/refresh and password migration without silently replacing live identities.
2. Implement machine-readable OpenAPI and contract validation/client generation.
3. Implement seller identity, account onboarding/recovery and the proposed auth model with targeted tests and reviewed migrations.
4. Follow remaining phase gates in PROPOSAL-IMPLEMENTATION-PLAN.md; real vendor work follows confirmed client decisions.

Status: first implementation batch, not phase completion or production readiness. No automatic database migration/deployment is part of this batch.
