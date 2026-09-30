# Verification record

## 22 September 2026 — error review and runtime recovery

- Backend build/lint: passed. **107 unit tests across 21 files and 16 isolated API tests passed.** OpenAPI and generated frontend types match; 39 operations remain documented. Frontend production build/typecheck/lint passed.
- Full backend and frontend npm audit scans each returned **0 known vulnerabilities** at check time.
- Read-only Prisma schema comparison completed successfully: **No difference detected.** The earlier P1001 comparison failure below is superseded by this successful check.
- Previously interrupted account/intake/booking service-contract regression passed with all synthetic records rolled back. Actual PostgreSQL JWT rotation/replay/logout verification passed again after the authentication fix.
- Fixed login/refresh racing with administrator deactivation: session creation now locks/rechecks the user. Added regression coverage for deactivation and password changes during login, and a session removed during refresh.
- Fixed stored valuation reads exposing quarantined `LEGACY_UNVERIFIED` numeric data. Such rows are excluded; authorization remains required.
- Fixed incomplete calendar configuration: URL-only/invalid/insecure configuration no longer advertises bookable slots or pushes pending reservations into an erroneous review-required state. Admin configuration indicators require a valid HTTPS URL and key; they still do not claim provider health.
- Fixed retries reporting queued work when nothing was requeued. Failed full-report jobs use conditional updates; stale concurrent retry requests do not reset claimed work or create duplicate retry audit entries. Broker UI distinguishes no-op retries from saved changes.
- Runtime check found frontend running but backend stopped. Restarted the corrected API with workers disabled. Homepage, broker login, broker signup, proxied readiness and OpenAPI returned 200. Anonymous `/api/auth/me` correctly returned 401.
- Configuration presence check (no values exposed): valuation, AI, calendar, transactional email and newsletter gateways and HTTPS public origin are unconfigured. No real messages or external provider requests were sent. Their live acceptance tests remain pending.

Remaining development and launch requirements are in BLUEPRINT-V3-IMPLEMENTATION.md; passing these checks is not a claim of complete blueprint implementation or production readiness.

## 21 September 2026 — auth, onboarding and database safeguards

- Backend build/lint, frontend production build/typecheck/lint passed. 93 unit tests across 18 files and 16 isolated API tests passed, including JWT claims/signature/expiry, refresh reuse revocation, invitation consumption, delivery cancellation, cursor boundaries and authorization.
- Real PostgreSQL rollback checks passed refresh rotation/reuse/logout and invited-broker verification/login, reissued-link invalidation, approval-bypass rejection, broker review/release, one release notification, consent scoping and immutable reviewed content. Newsletter/intake rollback checks also passed. No synthetic records are retained and no external provider is called.
- Three additive migrations (rotating sessions, report invariants, broker invitations) passed isolated schema rehearsals and were applied. Session/affected-table private backups were verified; affected table contents were restored and compared before the report migration. Direct release without review, payload editing, reversing release, and consent/audit evidence modification were rejected in database tests.
- OpenAPI and generated frontend types cover 39 operations. Legacy auth/endpoint-count statements below are historical.
- Browser: German/English invitation guidance and invalid-token handling inspected; desktop screenshot checked. Fixed hash navigation and effect-state handling in signup. No real emailed invitation or retained authenticated browser fixture was used; actual inbox receipt and full authenticated visual UAT remain unverified.
- A read-only Prisma schema-diff attempt returned P1001 (connection unavailable) rather than a schema result. Do not cite it as a successful drift comparison. One service-contract regression attempt also failed during database initialization; separately passing scripts do not turn that failed attempt into a pass.

This is not production acceptance. Vendor delivery, universal idempotency, complete endpoint/schema alignment, restricted production DB role, broader localization, infrastructure, security/load and client UAT remain tracked in BLUEPRINT-V3-IMPLEMENTATION.md.

## Earlier verification history

Update 20 September (Blueprint v3): backend build/lint and offline OpenAPI/client drift checks passed. Full unit run: 55 passing tests; five additional focused delivery-worker cases subsequently passed (60 total passing cases). Nine isolated API tests passed. Frontend production build/typecheck and lint passed without warnings. Full npm audit: zero known vulnerabilities in backend and frontend after removing unused vulnerable Nest Cloud deployment tooling. This is a dependency scan, not a security certification.

Real PostgreSQL rollback verification passed German-default intake; unticked newsletter creates no subscription; opted-in intake creates one pending subscription/outbox entry; idempotent retry; hash-based confirmation; replay rejection; withdrawal evidence; private strategy projection; denied unreleased full report. Synthetic properties/subscription/notifications were checked absent after rollback. No provider call or message was sent. The first test attempt reused one assessment token for two synthetic properties and correctly hit the unique-token constraint; the fixture was corrected to use independent tokens and passed.

Browser verification: original reference portal inspected; independent new desktop homepage visually reviewed. German/English toggle, retained form inputs, required-field blocking, House preselection, all four intake steps, versioned DE/EN consent text and both default-unchecked checkboxes inspected. At 390px viewport the homepage and intake had document width 375px matching the viewport content width, without horizontal overflow; mobile menu checked. Full authenticated broker UAT, rendered report/booking journey with real provider data and delivered-email confirmation are still pending. CI now defines isolated PostgreSQL integration and high-severity dependency gates; hosted CI was not run from this non-git workspace.

Tooling: Vitest native ESM/path configuration removes its previous deprecation notices. Node 24.14 can build/test this checkout but the Nest development tooling declares Node >=24.15 within the 24.x line; upgrading the local runtime remains an environment task.

Final local smoke check: homepage, proxied database readiness, German/English consent-copy endpoints and OpenAPI JSON each returned HTTP 200. Invalid newsletter confirmation was checked in the browser and showed a localized error without confirming a subscription. The final German desktop homepage had no captured browser console errors. Workers remain disabled in the running API.

Update 15 September: architecture/API-contract batch passed backend build/lint, 40 unit tests, 6 isolated API tests, frontend production build/lint/typecheck, OpenAPI validation and generated-contract checks. Real PostgreSQL service regression verified account creation/login, intake, assignment, booking reservation/retry and session revocation; all synthetic writes rolled back and absence checked. No provider calls or messages sent. Local OpenAPI JSON, Swagger UI and proxied readiness returned 200 with workers disabled. Runtime npm audit is clear; five development dependency advisories remain. CI configuration was updated but no hosted CI run occurred. Authenticated visual UAT and production readiness remain pending. See IMPLEMENTATION-PROGRESS.md.

Update 14 September: first implementation batch adds broker-wide search/filter pagination with controller/service/repository separation and repairs Prisma accessor/startup regressions. Backend build/lint, 33 unit tests, 6 isolated API tests passed. Frontend build passed; final loading adjustment lint/typecheck checked separately. Real PostgreSQL query regression passed in a rolled-back synthetic transaction, including access isolation and cross-page search. Updated authenticated screen has not been visually reverified. See IMPLEMENTATION-PROGRESS.md.

Update 12 September: approved database migration deployed after successful baseline comparison, private backup restoration and isolated migration rehearsal. Final schema comparison passed with no drift; backend readiness 200. Real PostgreSQL assessment service test passed creation, idempotency, ownership, lead, consent and audit checks with transaction rollback (no retained synthetic assessment). See DATABASE-DIAGNOSIS.md for backup location and legacy report effects. Earlier statements below that migrations were not applied are historical.

- Backend build: passed.
- Backend lint: passed, no reported warnings after cleanup.
- Unit tests: 22 passed across 8 files, including database startup failure and safe database error responses.
- Isolated API tests: 4 passed. These use a mocked database adapter.
- Prisma schema validation and client generation: passed.
- Frontend production build: passed for all 9 routes including API proxy and consultations.
- Frontend lint: passed.
- Browser: desktop homepage and four-step intake inspected; required location inputs block step progression; property selection/details/contact/unchecked consent reviewed.
- Browser: mobile homepage and intake inspected at 390px viewport; document content and viewport widths matched (375px excluding scrollbar), with no horizontal overflow.
- Redesigned navy/lime UI rechecked: four intake steps, required-field validation, homepage House preselection and mobile navigation. Fixed homepage overflow caused by Tailwind's container width combined with section margins.
- Browser: broker login inspected; unavailable backend reports a visible error. Live authenticated workspace actions were not exercised.
- Migrations: generated and inspected; NOT applied to the supplied database.
- Disconnected database runtime check (isolated localhost configuration): liveness 200, unauthenticated identity 401, readiness 503; API stays running. Supplied remote database connectivity failed and further read-only inspection was declined.
- External services, real database concurrency, Docker, CI execution, production deployment, complete WCAG audit and client UAT: NOT verified.

Vite prints advisory configuration deprecation warnings during passing backend tests. They are not runtime API failures, but should be addressed during dependency maintenance.
