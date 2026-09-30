# Blueprint v3: requirement audit and implementation record

Updated 21 September 2026. Primary specification: the supplied 32-page `Vision_Estates_Detailed_Engineering_Blueprint_v3.pdf`, dated 27 August 2026. This supersedes the v1-only audit where v3 changes the requirements. The reference `https://demo.privatverkaufen.de/` was inspected visually and interactively as design context, not as an instruction to add buyer, document-management, marketing or conveyancing modules outside the MVP.

**Status: substantial local implementation; NOT complete blueprint acceptance or production approval.** A passing build does not prove vendor delivery, consent wording approval, security readiness, uptime or client UAT.

22 September error review: corrected login/refresh deactivation races, excluded quarantined valuations from stored-value reads, blocked URL-only calendar configuration from advertising booking readiness, and made retry results reflect actual queued work. Backend restored; schema comparison shows no drift. Current verification: 107 unit + 16 API tests, both builds/lint and contract checks passed. All real provider gateways and HTTPS public origin remain unconfigured. The remaining development list at the end is still active.

## 21 September continuation

- Implemented 10-minute signed access JWTs and rotating, hash-only refresh sessions with a seven-day absolute lifetime. Database family locks serialize rotation/logout; reuse commits family revocation and an audit event before returning 401. Bearer and HttpOnly cookie access are supported. Existing opaque sessions remain valid only until their original expiry. Frontend renewal uses an in-tab promise and browser lock across tabs. Password hashing remains scrypt; password recovery/MFA are not included in this batch.
- Added admin-invited broker onboarding (an agreed extension, not an explicit public-signup requirement in v3): `/broker/signup`, administrator invitation UI, 48-hour purpose-bound single-use verification, broker-chosen password, queued email, reissue/revoke controls and invalidation of superseded links. Pending accounts cannot be activated through the ordinary account toggle. No public signup grants staff access. Existing administrator-created accounts retain compatibility.
- Applied additive session, report-invariant and invitation migrations after isolated rehearsals. Session/affected-table backups were verified privately; report backup was restored and compared in the rehearsal schema. Actual report mutations now enforce reviewed report content immutability, reviewer/releaser attribution, a service and database release gate, and irreversible release. Consent/AuditLog UPDATE, DELETE and TRUNCATE are rejected by database triggers. A database owner can still disable triggers; deployment must use a restricted runtime role. Legacy attribution FK is NOT VALID until historical rows are reconciled; new writes are enforced. No historical review evidence was fabricated.
- New generated reports link to their stored valuation ID. Existing legacy rows are preserved with nullable linkage. Reviewing a lead binds the review to currently generated full reports; a later generated full report needs a fresh review. Broker UI allows this additional review and disables premature release.
- Added cursor-paginated property, staff and audit lists; scoped consent history; owner/assigned-staff property and stored-valuation reads; assigned staff can read the seller-facing report endpoints while the full-release gate remains enforced. OpenAPI covers 39 registered operations with regenerated client types.
- Verified real PostgreSQL auth rotation/replay/logout and synthetic invitation-to-report-release workflow using rollback-only records. No emails, valuation, calendar or AI provider requests were sent.

Broker onboarding instructions and remaining rollout dependencies: [BROKER-ONBOARDING.md](BROKER-ONBOARDING.md). This continuation does not complete all pending blueprint work below.

## Implemented in this revision

- Original architectural homepage with custom SVG house illustration, independent navy/lime identity, property entry cards, four-stage process, report outline and FAQ. No competitor assets, testimonials, fake valuations or simulated client activity are included in the live product.
- German-default public homepage, guided intake, report workspace, newsletter pages and staff login; English toggle persists preference and retains intake fields. Submitted locale defaults to de-DE; en is supported and legacy en-GB accepted. Staff pipeline/admin copy is not yet fully translated.
- Seller workspace presents actual saved status, Value Signal, broker-review milestone and released full report. Includes missing-access, loading, pending-provider, booking-pending and error states. It does not mark a reservation as calendar-confirmed.
- Separate optional unchecked newsletter field; versioned German/English consent text is served by the API. Intake remains available without newsletter consent. Newsletter requests, consent history and confirmation-email jobs are transactional.
- Single-use 48-hour confirmation capability, hashed token persistence, atomic confirmation, replay/expiry rejection, no-login withdrawal, expiry sweep and append-only application consent operations. Signed capabilities are purpose-bound and are reconstructed for delivery; no raw bearer token is stored in the outbox. Confirmation pages require an explicit action to avoid email scanners confirming subscriptions by opening a page. Unsubscribe needs one button action and no login.
- Separate newsletter sender credentials; missing configuration leaves queued work pending. Every future newsletter job rechecks current CONFIRMED state and includes an unsubscribe link. Campaign authoring remains outside MVP. Real email receipt is NOT verified.
- Value Signal uses a server-side field allowlist, including for legacy payloads, stripping recommendation/positioning/strategy fields. Full strategy requires buyerPositioning, salesRoute and a non-empty strategy list. Both tiers are persisted together when the integration supplies valid full content; otherwise the valid Value Signal becomes ready and a durable full-tier retry job is created, as allowed by §4.4.
- Full-tier retries reuse stored valuation and never repeat the valuation call. Missing AI configuration leaves jobs pending. Retries are bounded; failures appear in queue counts and an authorized broker can requeue failed generation. Full release remains explicit, reviewed and audited, with a notification queued exactly on the first release.
- OpenAPI now covers 26 registered operations; generated frontend types and offline drift checks are updated.

## Requirement register

`Implemented` below means code exists for the named behavior, not production sign-off. `Partial` identifies material remaining work.

| PDF section / pages | Requirement | Current position / remaining work |
| --- | --- | --- |
| 0–1 / 4–8 | Germany-first seller acquisition; explicit exclusions | Implemented scope. Buyer verification, document AI, listings, CRM campaigns, portfolio advice remain excluded. |
| 1.3, 4.7, 6.2 / 7,21,24 | German default + English | Public UI implemented. Authenticated staff copy, localized validation detail, native-language content review and real provider/report/email locale acceptance remain partial. |
| 2.1,5.1 / 9,22 | Domain entities / explicit relationships | New reports link to valuations; reviewer/releaser relations added. Seller identity/FKs, legacy attribution/link reconciliation and reserved Documents entity remain pending. |
| 2.2 / 9–10 | Property/lead/report/booking state machines | Core states implemented. Draft editing, archival, full booking cancellation/reconciliation, version-bound reviews remain partial. |
| 2.3–2.5 / 10–12 | Event catalog, flows, bounded contexts | Transactional jobs implement several reactions. Formal typed domain-event bus and separate Nest bounded-context modules remain incomplete. |
| 3.1 / 13 | REST/versioning/problem responses | Implemented current /v1 contracts, typed responses and problem errors. Some endpoint names differ from the blueprint. |
| 3.1 / 13 | JWT/refresh/revocation | Implemented JWT access, rotating refresh, family locking/reuse detection, logout and deactivation revocation. Legacy sessions expire naturally. Password hashing remains scrypt; recovery/MFA and managed signing-key operations remain follow-up work. |
| 3.1 / 13 | All mutation idempotency + cursor pagination | **Partial:** intake retries and report-release side-effect deduplication work; universal key/TTL response caching and cursor list envelopes are not implemented. Current lead pagination is page-based. |
| 3.2 / 13–15 | Entire endpoint catalog | **Partial:** 39 operations documented, including generic property/valuation reads, refresh/session DELETE, consent history and admin audit/users. Draft PATCH, booking cancellation/public availability/catalog naming, scoring-rule editing, all-list cursor migration and property filters still need implementation/alignment. |
| 3.2,5.2,6.3 / 15,22,25 | Newsletter lifecycle | Implemented request/confirm/withdraw/expiry and queued delivery. Sender/domain setup, exact client-approved wording and test-inbox delivery remain required. |
| 3.5 / 17–18 | Outbound notifications | Value Signal ready, full report released, booking and newsletter jobs exist. Actual transport templates/delivery receipts, secure cross-device report access and broker calendar invitations remain partial. |
| 4.1,4.4 / 19–20 | Compact Value Signal / distinct full strategy | Field boundary, schema validation, partial success and durable full-tier retry implemented. Semantic strategy-leak classifier, actual two-call AI generation and evaluation corpus remain partial. |
| 4.2–4.5 / 19–20 | Prompt families/context/providers/failover/budgets | Generic full-strategy gateway only. Independently governed DE/EN prompt families, direct provider adapters, fallback vendor, token-cost ceilings and per-tier tracing remain incomplete. |
| 4.6,5.4 / 21,23 | Human release enforced in service AND database | Implemented service/database release gate, report-bound review fields, reviewer/releaser references, immutable reviewed payload and irreversible release. New writes enforced; historical nullable fields preserved and legacy releaser FK reconciliation pending. |
| 5.2–5.5 / 22–23 | Consent evidence/index/retention | Hashes, timestamps, copy/version evidence, expiry index and DB append-only triggers implemented. Existing Consent.userId is a subject identifier rather than a User FK. Seller identity alignment, restricted runtime-role provisioning, GDPR erasure/pseudonymization and retention operations remain pending. |
| 6.1–6.3 / 24–25 | Service/repository frontend/jobs | Core layers implemented. Services still use Prisma-shaped query arguments. Workers are single-instance polling, not a fully distributed leased job system. |
| 6.4 / 25 | Unit/integration/E2E/security tests | Unit/API and rollback integration coverage extended. UI checks are recorded separately. Email-inbox E2E, full authenticated broker UAT, concurrency/load and penetration testing remain pending. |
| 7.1–7.3 / 26–27 | Environments/CI/AWS/IaC | CI checks and Docker foundation exist. No client AWS resources, auto-staging, signed promotion, blue-green deploy or S3 report storage are provisioned. Current DB is Neon, not the specified AWS RDS. |
| 7.4–7.7 / 27–28 | Observability/secrets/releases/DR | Basic health/audit and private environment configuration exist. OTel, alerting, real deployment verification, managed key rotation and automated PITR restore evidence remain pending. |
| 8 / 29 | Complete operating documentation set | Existing README/API/integrations/runbooks-style docs plus this audit. The entire required documentation/ADR set is not yet delivered as completed production evidence. |

## Appendix E acceptance checks

| Acceptance | Evidence / status |
| --- | --- |
| Unticked newsletter does not degrade assessment | Browser checkbox confirmed unchecked; real DB rollback test confirms no subscription is created. |
| Ticked checkbox emails a confirmation; pending until clicked | Pending/queue/confirm implemented and tested; actual emailed-link receipt requires the newsletter provider. |
| No-login unsubscribe respected before next send | Capability/state transition tested; live-state guard is in worker. No real campaign was sent. |
| Seller only sees Value Signal before release | Server field projection and unreleased full read denial tested. |
| Release without broker review returns 409 | Service rule and real PostgreSQL report-release trigger verified. Reviewed report mutations/release reversal are rejected. |
| Release audit includes broker/time | Transactional audit implementation retained; notification is only queued on first transition. |
| DE default / EN explicit throughout | Public UI and fallback/report metadata supported. Full real AI/email content acceptance and localized validation errors remain pending. |

## Required private configuration

The application must not claim successful external work merely because a URL exists. Production provider onboarding requires separate verification.

- Licensed valuation provider selection and sandbox credentials.
- Full-strategy AI gateway/provider and reviewed German/English output examples.
- Google or Microsoft calendar choice and broker authorization.
- Transactional and newsletter email gateways, verified sender domain, SPF/DKIM and inbox testing.
- NEWSLETTER_TOKEN_SECRET: at least 32 random characters, managed privately. Changing it invalidates issued links. PUBLIC_APP_URL must be an HTTPS frontend origin for delivery links.
- Approved consent wording, privacy/imprint content, retention rules, scoring/release policy and client staging/cloud ownership.

No secret values were exposed, no real email was delivered and no production deployment occurred. Three additive migrations were applied in the 20–21 September continuation after rehearsals; existing records were preserved. A local signing key was configured privately.

## Next delivery order

1. Complete seller subject ownership/FKs, legacy report linkage and restricted runtime-role deployment. JWT/refresh and database release/consent triggers are implemented.
2. Complete draft/cancellation/availability/scoring endpoints, universal mutation idempotency, all-list cursor pagination and filtering. Consent history/admin list APIs are implemented; newsletter subjects are currently admin-only until ownership alignment is complete.
3. Connect the selected licensed valuation, AI, calendar and email providers in staging; validate exact blueprint cases with real sandbox responses and a test inbox.
4. Add consent/privacy production copy, private PDF/storage/recovery, retention, telemetry and operational controls.
5. Complete automated end-to-end/security/load testing, authenticated broker acceptance and reviewed production promotion.

The reference portal's uploads, buyer inquiries, marketing channels and notary flow must not be mistaken for missing MVP requirements; v3 explicitly excludes those expansions.
