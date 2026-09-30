# Vision Estates — run and manager demo guide

22 September check: 107 unit tests + 16 API tests, builds/lint, contract checks and read-only schema comparison passed; backend was restarted. Fixed session/deactivation races, legacy valuation exposure, incomplete calendar configuration and inaccurate retry feedback. Real provider credentials are absent, so provider-backed valuation, AI, calendar and email demonstrations remain pending. See VERIFICATION.md for evidence and limitations.

21 September continuation: JWT/refresh authentication, admin-invited broker verification/password setup, invitation reissue/revoke, report-bound reviews with database release protection, immutable consent/audit evidence, and additional scoped/cursor API reads are implemented. Current contract: 39 operations; tests: 93 unit + 16 isolated API. Frontend/backend builds and lint passed. See BROKER-ONBOARDING.md for the exact demo sequence. Email is queued only; delivery needs a configured transactional sender and HTTPS public URL. Full blueprint completion and production approval are still pending. The dated entries below are historical.

20 September v3 update: public screens now default to German with an English toggle. The homepage/intake/report workspace have a new architectural design. Optional newsletter consent is separate and unchecked; a tick creates a pending subscription and confirmation-email job, not an immediately subscribed contact or a delivered email. Live email/provider demos still require configuration. The current API contract has 26 operations, and the current recorded test suite is 60 unit + 9 isolated API tests. The older 14 September walkthrough below remains useful for staff workflow, but its English-only/newsletter-unavailable/API-pending statements are superseded. See BLUEPRINT-V3-IMPLEMENTATION.md for the current requirement audit and launch blockers.

14 September 2026. This is a local development demo, not a production launch. At preparation time homepage, backend liveness and frontend-proxied database readiness returned HTTP 200. Actual valuation, AI, calendar and email delivery remain pending integration.

## 1. Start on this computer

Frontend: http://localhost:3000
Backend liveness: http://127.0.0.1:3001/v1/health/live
Database readiness through frontend: http://localhost:3000/api/health/ready

Both services were already running when checked. Open the frontend directly. Do not start duplicate servers. When restarting, stop the existing project terminals with Ctrl+C, then run in PowerShell:

```powershell
cd C:\Users\Admin\Desktop\vision_estate
npm run dev
```

Keep that terminal running. Root dev starts both applications; no root npm install is needed. Use Node.js 24. After startup, readiness should return {"status":"ready"}. A live backend alone does not establish a working database.

If dependencies are missing on a fresh checkout, run these once:

```powershell
cd C:\Users\Admin\Desktop\vision_estate\backend
npm ci
cd ..\frontend
npm ci
cd ..
npm run dev
```

Existing backend/.env contains the database configuration and must not be replaced. If configuring a fresh environment, follow README.md. Frontend server variable API_INTERNAL_URL points to http://127.0.0.1:3001 (also the current default). Supplied database migrations have already been applied; normal startup does not require migrate reset, db push or re-baselining.

Alternative: separate terminals, backend `npm run start:dev`, frontend `npm run dev`. Do not run this alternative together with root `npm run dev`.

## 2. Set up accounts before the meeting

There is no default username/password and no public broker signup. Use an existing account if available. To create the first administrator, privately edit backend/.env to set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters) and optional BOOTSTRAP_ADMIN_NAME. Use your own chosen credentials; do not present this file on screen.

```powershell
cd C:\Users\Admin\Desktop\vision_estate\backend
npm run admin:create
```

After success, remove the bootstrap variables from .env. The database account remains. If the command says Account already exists, it has not reset the password. Password recovery is not implemented; do not promise a reset email.

Sign in at http://localhost:3000/broker/login with that administrator account. Open http://localhost:3000/admin and use Add a team member to create a broker with a distinct email, name, private initial password and BROKER role. Create a second demo broker only if demonstrating access isolation. Do not create shared client credentials.

Use the normal browser for seller/admin and a separate browser profile/incognito window for broker login. Normal tabs share the staff login cookie. Seller report ownership currently lives in the submitting tab's sessionStorage; keep that tab open and use localhost consistently (127.0.0.1 is a different origin).

## 3. Suggested 10–15 minute manager walkthrough

1. **Introduction:** "Vision Estates converts seller enquiries into structured, scored leads for brokers. The core local workflow works; external valuation, AI, calendar and email are still being integrated."
2. **Homepage:** show independent design and mobile layout. Explain that seller intake starts without a staff account.
3. **Validation:** leave address empty and click Continue. Show that required fields prevent progression. Enter five-digit German postal code, property type, area/year and contact data.
4. **Submission:** use clearly synthetic information approved for the demo environment. For example: Demo Seller, Demo Street 1, 80802 Munich, HOUSE, 100 m², year 2000, 4 rooms, Garden, ASAP, demo.seller@example.invalid. Tick processing consent deliberately. Submission persists records in the configured database; it is not a preview-only operation.
5. **Pending report:** show the saved request/pending assessment. Explain that an external licensed provider must supply the valuation; there is no fabricated estimate. With workers disabled the underlying state can remain SUBMITTED, which the UI presents as pending.
6. **Admin pipeline:** open /broker/leads as administrator, refresh and locate the synthetic seller. Open the detail and assign the lead to the demo broker using Assign a broker.
7. **Broker workflow:** sign in as that broker in a separate profile; show assigned lead, property/contact context, score/reasons, stage and notes. Change stage to CONTACTED and save a note such as "Demo follow-up discussed".
8. **Search:** search seller/street/city/postal code and click Search. Stage filtering operates across accessible records, with matching totals. Clear search and choose All stages to reset. A cross-page demonstration requires more than 50 suitable demo records; do not create them in client data just to illustrate pagination. The rollback regression test already exercised 52 synthetic records.
9. **Admin oversight:** show team activation/assignment, recent audit records, configuration presence and queue counts. Explain that scoring rules are currently read-only and configuration indicators are not vendor uptime checks.
10. **Close:** show IMPLEMENTATION-PROGRESS.md and the proposal plan. Distinguish verified behavior from missing integrations and full client UAT.

## 4. Cases and expected behavior

| Case | How to demonstrate | Expected / limitation |
| --- | --- | --- |
| Empty required input | Continue with missing address or contact data | Form prevents progression/submission |
| Invalid postal/email/area | Use malformed values | Browser and/or API validation rejects them; valid-looking postal code is not actual address verification |
| Consent unchecked | Submit contact step without consent | Submission blocked |
| Successful intake | Valid synthetic data and consent | Property, lead, consent and audit persist; user reaches assessment status |
| Selling intent score | Rooms + feature + ASAP | Current v1 gives 30 base + 5 rooms + 5 features + 35 intent = 75, HOT, before provider value points; provisional business rules |
| Exploring instead of ASAP | Same fields, EXPLORING | 40, COLD before provider value points; don't imply AI computed the score |
| Retry after uncertain submission | Same form request retries with original key | Same submission is reused; deliberately reloading/re-entering may create a fresh key and is not guaranteed duplicate detection |
| Provider not configured | Current pending assessment | No price generated; enabling workers alone does not implement providers |
| Wrong staff password | One incorrect attempt using a demo account | Generic incorrect email/password response; per-account lockout is still pending |
| Anonymous broker visit | Open /broker/leads while signed out | Login flow; private data API denies access |
| Unassigned lead | Broker opens pipeline before assignment | Lead not visible to that broker; admin can assign it |
| Broker A vs Broker B | Assign a demo lead to A; use B's separate profile | B cannot access A's lead; avoid exposing actual client information during demo |
| Stage/search combination | Search plus NEW/CONTACTED filter | Filters combine; totals count matching authorized leads |
| No search results | Nonmatching query | No matching leads, no fabricated data |
| Notes/stage update | Save note/change demo lead stage | Persists and records audit activity |
| Review completed | Record completed review on demo lead | Records broker review; does not perform a valuation or create a report |
| Release full report | Requires REPORT_READY full report and prior review | Not available for current pending submissions; do not claim live release demo without a real ready report |
| Share seller URL to incognito | Copy report URL without ownership token | Access denied; cross-device recovery is not implemented yet |
| Old legacy report | Open historical report without new ownership | May be denied; old reports were deliberately marked for reassessment in approved migration |
| Calendar availability | Broker creates future nonoverlapping local slot | Local availability is stored; it is not a Google/Microsoft calendar event |
| Real booking/confirmation | Needs ready report and configured calendar adapter | Not a current end-to-end demo; without integration booking is unavailable |
| Calendar write fails | Future integration failure test | Must not show confirmed; current backend has review-required state and incomplete reconciliation |
| Email notification | Explain queue implementation | No live sending configured; no inbox delivery claim |
| Deactivate demo broker | Admin uses demo account, not real user | Sessions revoked; account cannot continue accessing protected data |
| Database unavailable | Explain or simulate only in isolated test setup | Readiness 503; data actions fail safely. Do not change live DB settings during meeting |
| Overlapping/past availability | Broker enters past/overlapping demo slot | API rejects invalid slot |

## 5. Troubleshooting

| Symptom | Action |
| --- | --- |
| Browser cannot connect | Confirm root dev terminal is running; use port 3000, not retired 3100 |
| Port in use / another Next dev server | Reuse current server or stop the exact project terminal before restarting; do not kill all Node processes |
| Generic assessment-unavailable error | Check /api/health/ready and backend terminal. Readiness 200 plus a data error can mean schema/query mismatch, so do not assume every 503 is connectivity |
| No leads for broker | Verify role, assignment, search text and stage; refresh |
| Assessment keeps pending | Expected until licensed adapter and worker configuration are ready |
| Report private-access error | Return to original submitting tab/origin; don't weaken access checks |
| Admin account command fails | Verify private bootstrap configuration and password length; existing accounts are not overwritten |
| Login works but admin page denied | Account needs ADMIN role; broker role must not bypass it |

## 6. Questions the manager may ask

- **Is it ready for client launch?** No. Core local workflow is working, but full provider/AI/calendar/email integration, identity/security alignment, German localization, staging/production and UAT remain.
- **Who calculates the property value?** The selected licensed provider. AI only explains supplied evidence. Current app does not invent a value.
- **Is scoring AI-based?** No. Deterministic v1 rules with visible reasons; final weights require business approval.
- **Is the database real?** Yes. Migration, backup restoration and transactional regression checks were performed. That is not yet an automated production backup/PITR service.
- **What tests passed?** Last recorded: 33 unit tests, 6 isolated API tests, frontend/backend build checks, lint/typecheck and rolled-back PostgreSQL checks for assessment/query behavior. Full authenticated browser UAT and live vendor journey remain pending.
- **Can sellers access reports from another device?** Not yet. Current ownership is tab-session-based; verified account/recovery flow is planned.
- **What is next?** Complete API/OpenAPI and architecture alignment, account flows, provider integrations, production infrastructure and full acceptance testing per the PDF.
- **What is needed from the client?** Provider/calendar selections, initial account identities, secure API access, branding/German copy, privacy/scoring decisions and client-owned repo/cloud/domain access.

## 7. Optional developer checks before the meeting

Backend: npm run build; npm test; npm run test:e2e; npm run lint.
Frontend: npm run build; npm run lint.

Run checks separately and verify each succeeds. Database regression scripts use real PostgreSQL and rollback synthetic writes; do not run migrations/reset commands as part of a live presentation. Never show .env, backup.json, passwords or API keys on the shared screen.
