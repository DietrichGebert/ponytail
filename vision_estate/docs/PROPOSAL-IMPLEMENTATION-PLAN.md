# Vision Estates: proposal audit and delivery plan

20 September update: the user supplied Blueprint v3 (32 pages), which supersedes the original proposal where changed. Use [BLUEPRINT-V3-IMPLEMENTATION.md](BLUEPRINT-V3-IMPLEMENTATION.md) as the current gap/acceptance register. The v1 register below is historical.

Execution started 14 September 2026. See [implementation progress](IMPLEMENTATION-PROGRESS.md) for completed batches, pending decisions and verification. The register below is the original 12 September audit, not a claim that later work remains untouched.

Reviewed: 12 September 2026. Source: supplied 30-page Technical & Architecture Proposal, version 1.0, Draft for Review, dated 20 July 2026. Page numbers below refer to PDF pages. This is a requirements review and implementation plan, not a production approval or a new commercial agreement.

## Current position

The application is a functioning local implementation foundation. Seller intake, persisted property/lead/consent/audit records, scoring, access controls and workspace screens exist. The existing database was backed up, restored in an isolated rehearsal and migrated successfully on 12 September. The complete licensed valuation -> AI report -> real-calendar booking -> delivered email journey is not operational.

Local backend configuration inspection on this review found valuation/calendar/email gateway URLs and keys absent and WORKERS_ENABLED false. No secret values were printed. Bootstrap email is absent; this does not establish whether someone independently created an account. No account was created by this review.

The work spans parts of proposal phases 4 and 5, but phases 1-3 are not closed; it is not accurate to say that the first five phases are complete. A percentage would hide the unequal size and importance of the remaining integrations, security and deployment work. Appendix E launch acceptance is not signed off.

## Evidence and status conventions

- Verified: narrow behavior checked during this session or the recorded 11-12 September checks. This never means the whole feature has production acceptance.
- Partial: implementation exists but required behavior, integration or acceptance proof is missing.
- Missing: no corresponding implementation found in the inspected source/configuration.
- Unverified: requires environment/account/stakeholder evidence not available in this review.
- Deviation: implemented approach differs from the proposal; align it by default under the user's instruction to follow the proposal, or obtain an explicit documented exception.
- Future: explicitly excluded from the MVP; not a launch blocker unless its reserved foundation is specified for MVP.

Evidence map (paths relative to repository root):

| Key | Source |
| --- | --- |
| UI | frontend/src/app/page.tsx; components/site-header.tsx; components/intake-form.tsx; app/globals.css; app/layout.tsx |
| Intake | backend/src/properties/dto/create-property.dto.ts; properties.service.ts |
| Workspace | frontend/src/app/broker/{leads,bookings}/page.tsx; frontend/src/app/admin/page.tsx; backend/src/operations.ts; properties/properties.controller.ts |
| Auth | backend/src/auth.ts; scripts/create-admin.cjs; frontend/src/app/broker/login/page.tsx |
| Data | backend/prisma/schema.prisma; prisma/migrations; docs/DATABASE-DIAGNOSIS.md |
| Valuation | backend/src/properties/valuation-ai.service.ts; docs/INTEGRATIONS.md |
| Report | frontend/src/components/report-content.tsx; app/valuation/report/[id]/page.tsx |
| Scoring | backend/src/properties/scoring.ts |
| Delivery | backend/src/delivery-worker.ts; backend/src/operations.ts |
| Operations | backend/src/main.ts; health.ts; .github/workflows/ci.yml; Dockerfiles; compose.yaml; docs/OPERATIONS.md |
| Checks | docs/VERIFICATION.md; backend/src/**/*.spec.ts; backend/test; scripts/backup-rehearse.cjs; scripts/verify-assessment-transaction.cjs |

## Requirement-by-requirement register

Repeated requirements are cross-referenced rather than counted twice. Business context and commercial statements are distinguished from software features.

### Sections 1-4: business context and MVP (pages 3-6)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| B01 | Validate seller self-service and broker lead quality | Partial: intake and lead records; no measured business baseline | Define completion, qualification and follow-up metrics with client; privacy-reviewed event tracking and baseline report |
| B02 | Replace manual intake and inconsistent qualification | Partial: Intake + Scoring | Client-approved scoring and broker UAT with representative cases |
| B03 | Public mobile portal, no login before report readiness | Partial: UI verified; no seller login at report readiness | Preserve anonymous start; add the proposed seller identity/report-access flow |
| B04 | Address, size, condition and features validated before external calls | Partial: DTO + browser validation | Type-specific land/house/apartment fields, actual address validation and provider coverage mapping |
| B05 | One licensed valuation provider sets all numerical values | Partial boundary; real adapter missing | Select PriceHubble or Sprengnetter; authenticated sandbox calls, raw provenance and validated mapping |
| B06 | AI explains confidence, strengths, weaknesses and recommendations | Missing real AI: optional explanation from generic gateway | Implement separate AI providers and evidence-grounded output evaluations |
| B07 | Branded shareable professional report | Partial: HTML report + browser print | Complete report fields, server PDF, private storage and authorized sharing |
| B08 | Deterministic scoring using completeness/value/engagement signals | Partial: versioned rules for fields, timeline and value | Agree actual weights and engagement definition; preserve score inputs/history |
| B09 | Broker pipeline, detail, AI summary and context | Partial: workspace code exists | Real provider/AI-backed records; authenticated multi-broker UAT; workflow/search corrections |
| B10 | Book directly against broker calendar | Partial: local slots/reservation | Real free/busy, external event write and synchronization |
| B11 | New-lead and booking-confirmation email | Partial: queue only | Real transport, templates, verified sending domain and delivery failure handling |
| B12 | Admin/Broker RBAC and key action audit | Partial: guards + transactional event records | Role/ownership regression coverage, identity completion and access/export audit coverage |
| B13 | German and English market experience | Partial: English only, hard-coded locale | German/English UI, validation messages, emails, reports, dates/currency and accessibility checks |
| B14 | Buyer matching, Document AI, campaigns, CRM sync, native apps | Future, explicitly outside MVP | Do not implement these now; preserve specified extension interfaces and Documents model |
| B15 | UI direction | Implemented independent navy/lime design per user | Preserve this design; PDF specifies workflow, not copying the example site's appearance |

### Sections 5-6: architecture and technology (pages 7-8)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| A01 | Frontend -> backend -> business -> AI/data/integration boundaries | Partial: Next BFF and Nest; controller/business/data concerns mixed | Separate repositories, services, adapters and workers; dependency boundary tests |
| A02 | Frontend does not call vendor APIs directly | Implemented in inspected code | Preserve server-side integration secrets and this boundary |
| A03 | Next.js/React/TypeScript/NestJS/PostgreSQL/Prisma | Implemented | Maintain typed contracts and reproducible builds; no framework rewrite needed |
| A04 | Redis valuation/reference caching | Missing | Define property/provider/version cache key, TTL, stale rules and invalidation |
| A05 | Docker identical images across environments | Partial: Dockerfiles + DB compose | Build/run images, scan them, validate health checks and promote same image digest |
| A06 | AWS RDS/ECS or Fargate/S3/CloudWatch | Missing project infrastructure; current database is Neon | Client AWS account and EU environment; rehearse migration from Neon if strict AWS alignment is retained |
| A07 | GitHub Actions tested deployable build | Partial workflow file; no .git here | Client-owned repository, protected branch, actual CI evidence, registry and deployment jobs |
| A08 | S3 durable/versioned report objects | Missing | Private encrypted bucket, object versioning, retention and authorized short-lived downloads |
| A09 | JWT + Seller/Broker/Admin RBAC | Deviation: PostgreSQL sessions and Broker/Admin only | Implement short-lived JWT, refresh rotation/reuse handling, seller role and explicit logout/revocation semantics |
| A10 | OpenAPI-generated documentation/client types | Missing: hand-written API guide | Versioned OpenAPI contract, generated frontend types and contract drift check in CI |
| A11 | OpenTelemetry instrumentation | Missing | Trace/metric/log correlation with PII redaction and integration dashboards |
| A12 | Interchangeable AI provider implementations | Missing: generic gateway is not a provider interface | OpenAI + Anthropic adapters selected through environment configuration |

### Section 7: data architecture (page 9)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| D01 | Users include sellers, brokers and admins | Partial/deviation: User has Broker/Admin only | Seller identities and owned property/booking relationships; migration strategy for token-owned properties |
| D02 | Roles and many-to-many user permissions | Deviation: single role enum | Align normalized role model or obtain a documented proposal amendment |
| D03 | Property belongs to seller User | Missing relation: contact JSON/token currently | Add explicit ownership FK and safely link only verified sellers |
| D04 | Store vendor valuation response verbatim | Partial: normalized gateway JSON saved | Persist unmodified vendor response, provider request/version/time and normalized result separately |
| D05 | Versioned lead score and rule inputs | Partial: current score/version/reasons stored on Lead | Score history, full inputs, configurable rule version and reproducible re-scoring |
| D06 | Report belongs to valuation | Deviation: reports relate only to Property | Explicit valuation/report version relation so broker reviews the exact result released |
| D07 | Bookings link seller and broker | Partial: property + slot -> broker | Seller FK, lifecycle fields and reconciliation history |
| D08 | Notification tracking and user relationship | Partial: recipient string, queue status | User relation where applicable, vendor message ID and accepted/delivered/bounced distinction |
| D09 | Append-only audit entity | Partial: application appends rows | Restricted DB permissions; access/export/permission events and retention policy |
| D10 | Reserve Documents model now | Missing | Minimal property-owned Documents model; no upload or parsing feature in MVP |
| D11 | Composite property/time indexes and email/calendar indexes | Partial: several indexes exist; proposed composites incomplete | Query-plan review and migrations for actual lookup patterns |
| D12 | Service-level ownership, PII encryption, least-privilege DB roles | Partial: ownership implemented | PII/key-management design, DB encryption evidence and separate environment roles |
| D13 | Daily backups and tested point-in-time recovery | Partial: one manual data backup restored successfully | Automated snapshots/PITR, retention, restore drill and agreed RPO/RTO; manual backup is not PITR |
| D14 | Read replica/region scaling path | Unverified | Document routing and capacity plan; provision only at agreed scale |
| D15 | Existing schema migration | Verified on 12 September | Baseline + workflow deployed; no final schema drift; preserve backup and migration evidence |

### Section 8: backend (page 10)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| BE01 | Resource APIs matching OpenAPI | Partial: /v1 routes exist | Finalize resources/action semantics in the contract; generated contract tests |
| BE02 | Thin controllers -> services -> repositories | Deviation: operations/controller classes directly query Prisma | Move booking/admin/report rules into services and all persistence into repositories |
| BE03 | Framework-independent business rules | Partial: scoring is pure; other services Nest-dependent | Separate report/booking domain rules from transport and persistence |
| BE04 | DTO validation | Implemented core cases, recorded tests | Expand type-specific fields, date/time edge cases and all error contracts |
| BE05 | JWT refresh rotation and authorization | Deviation/partial | A09 plus expiry/reuse/revocation/access-denial tests |
| BE06 | Redis bounded provider cache | Missing | A04 plus licensed provider caching restrictions |
| BE07 | Consistent safe centralized errors | Verified narrow DB error handling; filter exists | Complete error taxonomy for provider failure, validation, conflicts, not-found and correlation IDs |
| BE08 | Structured JSON request logs shipped to CloudWatch | Partial: request IDs/some logs | Request-scoped logger, redaction and central delivery |
| BE09 | URI versioning /v1 | Implemented | Contract evolution and backward compatibility tests |

### Section 9: frontend (page 11)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| FE01 | Seller/Broker/Admin surfaces sharing components | Partial: screens, header and report component exist | Shared form/table/status primitives and complete authenticated journeys |
| FE02 | Admin user management | Partial: create and active-state APIs/UI | Account setup, recovery/invitation policy and multi-admin tests |
| FE03 | Admin scoring configuration | Missing editing: overview only displays hard-coded rules | Validated versioned rule editor, preview and audit |
| FE04 | Admin system health | Partial: config booleans/counts | Actual provider checks and queue lag/failure/retry visibility; URL presence is not integration health |
| FE05 | Mobile-first seller flow | Verified intake/navigation layouts in prior browser checks | Full real-report/booking mobile acceptance still pending |
| FE06 | WCAG 2.1 AA public portal | Partial semantics/focus support; not audited | Keyboard, screen reader, contrast, error announcements and zoom audit |
| FE07 | SSR and optimized images | Partial: SSR present, remote CSS hero image | Optimize responsive assets, measure mobile paint and establish performance budget |
| FE08 | SEO metadata | Partial: title/description only | Approved discovery-page metadata, canonical/social/structured metadata where applicable; private pages excluded |
| FE09 | Reliable broker search/filter/detail | Improvement found: filters currently apply only to fetched page | Server-side search/filter with matching totals and dedicated detail fetch; pagination tests |
| FE10 | Seller report persistence/access | Partial sessionStorage ownership | Verified recovery and cross-device report access through seller identity; never weaken ownership to fix lost links |

### Sections 10-11: AI and integrations (pages 12-13)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| I01 | Provider value immutable to AI | Partial: no fake values; validation boundary | Dedicated typed numeric source; test hallucinated/change-of-price outputs cannot overwrite it |
| I02 | Confidence explanation, strengths, weaknesses | Partial display/schema; confidence is category only | Evidence-grounded confidence explanation and validated narrative fields |
| I03 | Market summary, recommendations, next steps | Partial fallback/gateway fields | Real AI with licensed evidence, no invented market facts, German/English output |
| I04 | Draft internal broker summary | Missing dedicated AI generation | Separate internal summary schema/context with correct access controls |
| I05 | OpenAI and Anthropic configurable providers | Missing | Common generate interface, concrete adapters and configuration switching tests |
| I06 | Prompts versioned outside app code, editable without deploy | Missing | Managed versioned templates, validation, release/rollback and prompt version on every report |
| I07 | Schema validation rejects malformed/empty AI output | Partial gateway arrays/text validation | Separate AI schema, grounding evaluation, bounded output, failure/fallback states |
| I08 | Primary licensed provider adapter | Missing; not merely missing a key | Official API mapping, credentials, coverage tests and provider-attributed real result |
| I09 | Timeout/backoff/stale cached valuation | Partial timeout/manual retry only | Exponential backoff with jitter, attempt tracking, cached licensed results with visible staleness |
| I10 | Google Maps address validation/geocoding | Missing | Debounced UI, restricted credentials, server validation/fallback and location confidence |
| I11 | Real calendar availability and two-way conflict sync | Missing real adapter | Authorized broker calendars, free/busy, event changes/webhooks, timezone/DST and conflicts |
| I12 | Confirm only after successful external calendar write | Implemented gateway condition, unverified with vendor | Deduped vendor event write and reconciliation after timeout; no premature seller confirmation |
| I13 | Queued email, retry and broker-visible failure | Partial: bounded fixed-interval retries, admin counts | Real email transport, backoff, delivery webhooks and actionable broker/admin failures |
| I14 | Reserved CRM adapter interface | Missing explicit interface | Define extension contract only, no CRM sync implementation |
| I15 | Per-integration latency/error telemetry | Missing | OpenTelemetry spans/metrics, alert thresholds and tested provider-outage alert |

### Sections 12-14: security, performance and infrastructure (pages 14-16)

These are proposal commitments to implement and review, not a claim of current legal compliance.

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| S01 | JWT + refresh rotation | Deviation | A09; document apparent PDF tension between Redis sessions (p7-8) and no session store (ADR-004) |
| S02 | Argon2id or documented bcrypt fallback | Deviation: scrypt | Adopt specified hashing with safe migration/re-hash strategy for existing users |
| S03 | HTTPS/HSTS/no mixed content | Unverified production; localhost HTTP | TLS termination, HSTS and secure cookies tested on staging domain |
| S04 | Per-IP and per-account auth/valuation limits | Partial: process-local per-IP counters | Shared limits across replicas, per-account abuse controls and API-cost controls |
| S05 | Repeated-login account lockout | Missing | Bounded lockout policy, generic responses and recovery tests |
| S06 | Server RBAC/ownership on all private resources | Partial: guards and assignment checks | Full endpoint permission matrix, cross-broker/seller/admin integration tests |
| S07 | Append-only access/export/permission audit | Partial event coverage | D09 plus report reads/downloads, denied sensitive operations and permission changes |
| S08 | PII encryption at rest/TLS/managed DB encryption | Partial/unverified | Client-approved encryption/key rotation implementation and infrastructure evidence |
| S09 | Managed secrets, none committed | Partial: .env ignored | Managed secrets in client AWS, environment isolation, secret scanning/rotation |
| S10 | Injection resistance and strict validation | Partial Prisma/DTO coverage | Review every query/adapter and malformed input cases; raw SQL kept parameterized |
| S11 | Threat model and reviewed infrastructure defaults | Missing | Threat model + IaC review before staging release |
| S12 | Dependency/static scanning in CI | Partial lint only | Dependency/secret/static scans, triage and evidence of no unresolved critical/high findings |
| S13 | Data export/delete, inactive-lead retention, lawful basis at intake | Missing except consent text/record | Client privacy decisions and reviewed copy; authenticated export/erasure, retention jobs and exception audit |
| P01 | Async report and email jobs | Partial DB polling workers | Durable leases, retries, dead-letter/replay, multi-worker and crash tests |
| P02 | Horizontal scaling | Not demonstrated | Eliminate process-local coordination/rate limits; multi-instance integration tests |
| P03 | Query-aligned indexes | Partial | D11 plus pagination/load measurements |
| P04 | Next image optimization and CDN | Missing optimized hero/CDN setup | FE07 plus staging/CDN verification |
| O01 | AWS environment/IaC | Missing | Client-owned EU AWS stack, least privilege, costs/capacity agreed |
| O02 | Containers and image promotion | Partial scaffolds | A05; images used consistently in staging/prod |
| O03 | Automated test/build/deploy pipeline | Partial CI file | Client Git repository, actual CI run, staging deploy and deliberate production promotion |
| O04 | CloudWatch + OTel | Missing | Central logs, metrics/traces, dashboards and actionable alerts |
| O05 | Liveness/readiness per service and removal from traffic | Partial backend probes verified | Container/load-balancer probes for all services; unhealthy replica test |
| O06 | Separate local/staging/production secrets/data | Unverified | Three environment inventory, separate credentials/databases and no client-data test defaults |

### Sections 15-23 and appendices (pages 17-30)

| ID | Requirement | Status and evidence | Work / acceptance evidence needed |
| --- | --- | --- | --- |
| G01 | Discovery decisions and signed requirements/NFRs | Open | Client decisions listed below; no invented fixed timeline or SLA |
| G02 | Final data model/OpenAPI/ADRs | Partial schema only | D/A/BE corrections, ERD, complete ADRs and stakeholder review |
| G03 | Unit tests for business logic/report assembly | Partial: prior 22 tests pass | Add missing report/queue/provider/booking domain cases |
| G04 | Integration APIs against real test DB with mocked vendors | Partial: 4 mocked-DB API tests + one real DB service rollback test | Isolated PostgreSQL API suite; concurrency/failure scenarios |
| G05 | Automated end-to-end seller/report/booking and broker flow | Missing | Browser suite against staging with deterministic provider fixtures and separate live sandbox verification |
| G06 | Security, performance and UAT | Unverified | Scans/manual review, realistic load test and named client acceptance |
| G07 | Architecture + API + database documentation | Partial text guides | Final ADRs, published OpenAPI, ERD and migration guide |
| G08 | Deployment, maintenance, developer, admin and incident guides | Partial runbook/setup scaffold | Complete operational walkthroughs, scoring/config admin guide and independent handover rehearsal |
| G09 | Staging mirrors production and reviewed main-branch release | Missing deployed evidence | Reproducible staging with reviewed/green build promotion |
| G10 | Blue-green deploy/health-gated cutover/automatic rollback | Missing | Rehearse failed and successful release; retain previous image and compatible DB migration plan |
| G11 | Deployment events alongside runtime metrics | Missing | Correlate release identifiers with traces/errors |
| G12 | Client ownership of repo/data/cloud/domain/docs | Unverified; local folder is not a Git repo | Client-owned accounts/repo; verify independent access and handover without printing secrets |
| G13 | Monitoring, triage, vulnerability/framework update cadence | Partial runbook intention | Owners, alerts, schedules and incident rehearsal |
| G14 | Agreed maintenance SLA | Open commercial decision | Client agrees severity/response/resolution terms; proposal contains no fixed numbers |
| G15 | Phase 2 roadmap | Future | Buyer/Document AI/CRM/marketing/workflow/internal assistant later; D10/I14 foundations now |
| G16 | Investment rationale and closing statements | Context, not extra features or accepted contract | No pricing invented; document delivery and ownership commitments |
| G17 | Appendix A risk register | Partial source register | Track provider outage, misleading AI, drop-off, privacy, scope, vendor/adoption/growth owners and controls |
| G18 | Appendix B ADR-001/002/003 | Partial/implemented stack | Preserve numeric-source separation, implement AI interface, retain PostgreSQL/Prisma |
| G19 | Appendix B ADR-004/005/006 | Deviations/missing | JWT model, reserved Documents entity, blue-green pipeline |
| G20 | Appendix C availability/scalability/security/observability | Unverified | Agree measurable targets, then stage/load/security tests; PDF has no explicit numeric latency or uptime guarantee |
| G21 | Appendix C maintainability/DR/data residency | Partial tests/docs/manual restore | Daily/PITR restore tests, agreed RPO/RTO and verified EU hosting; Neon location alone does not fulfill AWS stack |
| G22 | Appendix D dependencies and accountable client contact | Open | Vendor/AI/calendar accounts, brand, domain/DNS, AWS ownership and decision-maker |
| G23 | Appendix E formal stakeholder sign-off | Not achieved | Complete acceptance register below; this alone defines MVP launch completion |

## Concrete defects/improvements to prioritize

These are source-inspection findings, not claims that each has been reproduced in production.

1. **Jobs stop after provider failure:** the valuation catch sets processingError; the polling query excludes pending rows with an error. There is a manual retry endpoint, but no automatic exponential retry. Add attempt/nextAttemptAt fields, durable leases and visible terminal failures.
2. **Calendar failure leaves a slot held:** failed writes become CALENDAR_REVIEW_REQUIRED; no complete retry/reconcile/cancel flow is present. Implement vendor reconciliation before releasing ambiguous reservations.
3. **Email workers lack a database job claim:** per-process busy flags cannot coordinate multiple replicas. Add atomic claims/lease expiry and vendor idempotency; distinguish provider acceptance from delivery.
4. **Broker filters only search the loaded page:** move filter/search/sort into paginated backend queries and keep totals consistent.
5. **Configuration flags can look healthy without valid integration:** URL booleans are not connectivity/credential checks. Expose configured/healthy/degraded separately without secrets.
6. **Report provenance is incomplete:** normalized gateway data is not the original vendor payload; Report has no valuation FK or prompt/model version. Add provenance before generating real client reports.
7. **Seller session loss has no recovery:** closing/losing sessionStorage can make reports inaccessible. Add verified ownership recovery; never expose reports by ID alone.
8. **Admin rule configuration is read-only:** make the PDF-required rule configuration versioned and auditable.
9. **Account setup is an operations gap:** establish the initial administrator and broker accounts using client-approved identities; implement recovery and initial password change. Do not invent shared/default logins.
10. **Existing docs contain historic status:** use this dated register and DATABASE-DIAGNOSIS.md as current status. Migrations did run; the current UI is navy/lime. Refresh all final handover docs before delivery.

## Implementation sequence and phase exit criteria

This follows the proposal's eleven-phase sequence. Existing code is retained and improved; the new UI is not redesigned again.

| Phase | Concrete implementation/deliverable | Exit condition |
| --- | --- | --- |
| 1 Discovery | Confirm provider/coverage, calendar, AI accounts, languages/branding, scoring, report release/identity policy, NFR/RPO/RTO and client decision-maker | Requirements register and decision log agreed; credentials supplied through secure environment setup |
| 2 Architecture | Typed OpenAPI + generated clients, ERD, seller/roles/report provenance/Documents schema, repositories, JWT/refresh and hashing migration design, threat model and ADRs | Reviewed contracts and data migrations; no silent proposal deviations |
| 3 Infrastructure | Client Git repo, isolated local/staging/prod configs, Docker build, EU AWS IaC, Redis, S3, secrets, CI tests/scans, automated backup policy | Green CI and working staging; backup/restore and environment isolation proven |
| 4 Backend | Identity/account recovery, ownership/roles, scoring config/history, corrected queries, audited operations, durable queues, privacy export/erasure/retention and migrations | Real PostgreSQL API/permission/concurrency tests pass without external live side effects |
| 5 Frontend | Retain navy/lime design; German/English seller/broker/admin flow, type-aware intake, accessible errors, seller recovery, broker filters, admin rule/health screens, report download UI | Keyboard/mobile acceptance and authenticated journeys against finalized API pass |
| 6 AI | OpenAI + Anthropic implementations, external versioned prompts, report schema/grounding, broker summary, provenance and safe fallback | Provider switching and hallucination/malformed-output evaluations pass; valuation unchanged |
| 7 Integrations | One licensed valuation adapter, Maps, selected calendar free/busy/write/two-way sync, email delivery, server PDF/S3, retries/cache/telemetry | Real vendor sandbox end-to-end journey passes; fail/timeout/duplicate/DST cases handled |
| 8 Testing | Full API/browser suites, concurrency, vulnerability/manual security review, accessibility/performance and broker/seller UAT | All agreed criteria pass; no unresolved critical/high launch issues |
| 9 Deployment | Staging rehearsal, blue-green promotion, auto rollback, compatible migrations, secrets/restore/runbook checks | Successful deployment and deliberately failed deployment both behave as designed |
| 10 Launch | Named client acceptance, domain/DNS, production monitoring and ownership verification | Appendix E signed; controlled production release |
| 11 Support | Incident owner, alerts, patch cadence, restore schedule, measured completion/lead quality and agreed SLA | Handover demonstrated; maintenance arrangements active |

Dependencies: define adapter interfaces in phase 2; build deterministic fixtures in test environments while provider accounts are being arranged. Validate phase 6 with licensed sample evidence and revalidate with live sandbox data in phase 7. Fixtures must never be presented as real seller valuations. No external service can be marked complete merely because a configuration field or generic gateway exists.

No fixed cost or completion date is asserted. The proposal itself makes timelines conditional on discovery; provide phase estimates once provider contracts, access, team capacity and acceptance targets are known.

## Appendix E acceptance tracking (PDF page 30)

| Criterion | Current position | Required proof |
| --- | --- | --- |
| Mobile seller completes entire valuation flow unaided | Partial: intake verified | Real report delivered via chosen provider and seller access verified |
| Report has value/confidence explanation/strengths/weaknesses/recommendation/market/next steps/CTA | Partial HTML/schema | Licensed-source report with validated German/English AI content and PDF |
| Broker sees qualified scored lead/context within minutes | Partial persistence/UI | Timed representative staging submission and authorized broker visibility |
| Seller books against real availability | Missing integration | Calendar event, conflict handling and confirmed seller booking |
| All endpoints match OpenAPI | Missing | Published specification plus generated contract checks |
| Every private route enforces auth/RBAC | Partial | Full role/ownership matrix passing on real test database |
| Automated suite passes in CI without critical defects | Local partial evidence | Client repository CI plus full API/E2E results |
| OWASP review with no unresolved high severity | Unverified | Security review report and resolved findings |
| Blue-green deploy with tested rollback | Missing | Successful promotion and rollback rehearsal |
| All section 17 docs delivered | Partial | Final complete handover pack |
| Client independent repo/cloud/database access | Unverified | Client verifies account ownership/access |
| Named stakeholder formal sign-off | Not done | Recorded acceptance after all above gates |

## Client inputs needed before dependent implementation

1. Primary licensed provider: PriceHubble or Sprengnetter; account/API access and property-type coverage.
2. Calendar: Google Calendar or Microsoft 365; broker identities and delegated access.
3. AI accounts for proposed OpenAI and Anthropic support; permitted processing configuration.
4. Initial admin/broker emails and role owners; passwords/API keys through secure setup, not chat.
5. German/English brand copy, company assets and reviewed privacy/retention/report-release decisions.
6. Client-owned AWS, GitHub repository, domain/DNS and transactional email sender setup.
7. Scoring thresholds, engagement definition, operating volume, performance/availability and recovery objectives.

Optional additional hardening such as MFA or broader cancellation/rescheduling product features should be recorded separately where not explicit in the PDF. Calendar reconciliation and access recovery are still needed for an operable MVP. Do not silently grow the MVP into marketing/CRM/Document AI work.

## What was and was not done during this review

Read all 30 PDF pages as text; visually checked the workflow, data model and acceptance pages. Re-inspected the current key frontend/backend/schema/worker/auth/CI sources and local integration configuration booleans. Prior verified results remain 22 unit tests, 4 mocked-DB API tests, frontend/backend builds/lint, UI checks and the 12 September database migration/restore/service rollback test. These suites were not rerun during this planning review. No live provider call, new account, deployment, database mutation or application-code change was performed. This plan is the requested next deliverable; implementation follows it after the user reviews it.
