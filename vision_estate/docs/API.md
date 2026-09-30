# API guide

21 September continuation: the generated contract now covers **39 operations**. Authentication uses 10-minute JWT access tokens and rotating hash-only refresh sessions (seven-day absolute expiry); POST `auth/refresh` rotates the HttpOnly `ve_refresh` cookie and DELETE `auth/session` revokes its family. Access uses Bearer JWT or HttpOnly `ve_access`. Legacy `ve_session` cookies retain their original expiry only. Automatic frontend refresh keeps tokens out of local storage.

Added endpoints:

| Method | /v1 route | Access / purpose |
| --- | --- | --- |
| POST | admin/broker-invitations | Admin; inactive broker and queued invitation |
| POST | admin/broker-invitations/:id/resend | Admin; rotate invitation, invalidate previous links |
| DELETE | admin/broker-invitations/:id | Admin; revoke unused invitation |
| POST | auth/invitation/inspect | Public capability `{token}`; read invited identity without activating |
| POST | auth/invitation/accept | Public capability `{token,password}`; single-use verification/password setup |
| GET | admin/users | Admin; credential-free cursor list |
| GET | admin/audit-logs | Admin; immutable audit cursor list |
| GET | consents/:id | Admin or broker assigned to the property subject; cursor evidence without IP hash |
| GET | properties | Admin/assigned broker; cursor list |
| GET | properties/:id | Owner or assigned staff; no credential/hash fields |
| GET | properties/:id/valuation | Owner or assigned staff; stored provider range/value/staleness |

Cursor lists accept `cursor` and `limit` (1–100, default 25) and return `{data,nextCursor}`. Existing leads page-based pagination remains compatible and is not yet migrated. Report reads now also accept assigned staff; full-report reads still require release. Report review binds immutable content to named staff; release remains service/database enforced. Newsletter subscription consent subjects remain admin-only until seller identity/FK alignment is completed.

See [broker onboarding](BROKER-ONBOARDING.md) for delivery/setup details. The older endpoint table below remains applicable except where superseded here.

20 September v3 additions: GET /v1/newsletter/copy?locale=de-DE|en returns versioned consent text; GET /v1/newsletter/confirm?token=... consumes a valid unexpired confirmation token; POST /v1/newsletter/unsubscribe with {token} withdraws consent without login. A confirmation token cannot be used to withdraw and consumed tokens cannot confirm again. Copy defaults to German. Newsletter enrollment remains pending until mailbox confirmation; delivery requires separate newsletter configuration.

Intake now accepts optional newsletterOptIn true/false independently of required data-processing consent. Locale defaults to de-DE; en and legacy en-GB are accepted. Existing idempotency/owner-token headers remain required. The Value Signal response strips strategic fields; full-report content is returned only after release. Full strategy retries use stored valuation and do not block an available Value Signal. The machine-readable contract covers 26 current operations; it is not yet an exact match for every endpoint in Blueprint v3.

Frontend calls /api/...; the Next.js server proxies to private backend /v1/.... All non-public routes are enforced server-side.

Seller ownership uses x-assessment-token, a browser-generated 32-byte random hex secret stored server-side only as a SHA-256 hash. Assessment tokens are never placed in URLs. Invitation/newsletter capabilities use URL fragments to avoid request-path logging.

| Method | /v1 route | Access / purpose |
| --- | --- | --- |
| GET | health/live | Public liveness |
| GET | health/ready | Public database readiness; no connection details returned |
| POST | auth/login | Public email/password authentication |
| GET | auth/me | Authenticated account identity |
| POST | auth/logout | Revoke current session |
| POST | properties | Public validated intake; idempotency-key and x-assessment-token required |
| GET | properties/:id/status | Assessment owner; workflow status and address |
| GET | properties/:id/report/value-signal | Assessment owner; seller-visible report only |
| GET | properties/:id/report/full | Assessment owner; released full report only |
| GET | properties/:id/slots | Assessment owner; assigned active broker's offered slots, calendar integration required |
| POST | properties/:id/bookings | Assessment owner; slotId; reserve unclaimed future slot |
| GET | properties/:id/bookings | Assessment owner; own booking confirmation state |
| GET | leads?page=1&q=Munich&stage=NEW | Admin: all; broker: assigned leads; search/filter before pagination; 50 per page |
| PATCH | leads/:id | Owning broker/admin; stage and/or notes |
| POST | leads/:id/review | Owning broker/admin; record completed review |
| POST | leads/:id/retry-valuation | Owning broker/admin; retry failed valuation |
| POST | reports/:id/release | Owning broker/admin; ready property and completed review required |
| GET | broker/bookings | Broker's bookings, or all for admin, maximum 100 |
| POST | broker/slots | Authenticated broker/admin's own future availability |
| GET | admin/overview | Admin only; team, queues, config presence, audit and score rules |
| POST | admin/users | Admin only; name/email/password/role |
| PATCH | admin/users/:id | Admin only; active boolean, cannot deactivate self |
| POST | admin/leads/:id/assign | Admin only; active brokerId |

Intake body is defined in backend/src/properties/dto/create-property.dto.ts. Missing processing consent, invalid enums, invalid email/postal code, negative size and unknown fields are rejected. Newsletter consent is optional and never preselected.

Lead list query: page is an integer from 1 to 10000 (default 1); q is an optional trimmed literal search up to 120 characters across seller name/street/city/postal code, case-insensitive; stage is one of NEW, CONTACTED, QUALIFIED, CONSULTATION_BOOKED, WON, LOST (omit for all). Response: items, total (matching accessible leads), page (clamped to last available page), pageSize (50). Invalid query fields return 400. Count and page use one database snapshot; ordering is createdAt DESC then id DESC. Search text is not stored in audit metadata.

Problem responses use HTTP status and detail. Common cases: 400 validation, 401 login required, 403 ownership/role denied, 404 report not ready, 409 conflicting submission/slot/release, 429 write throttling and 503 unavailable integration.

Frontend prints a report locally. There is no hosted PDF export/share API, public report-by-ID API, password recovery API or OAuth callback endpoint.

The machine-readable contract is [openapi.json](openapi.json). Local read-only Swagger documentation is at http://127.0.0.1:3001/docs; raw JSON is at /v1/openapi.json. Production documentation is disabled unless API_DOCS_ENABLED=true.

After installing both applications' dependencies, run `npm run contract:generate` from backend to build and export registered Nest routes plus maintained payload schemas, then regenerate frontend response types. Commit both docs/openapi.json and frontend/src/lib/generated/api-types.ts. Run `npm run contract:check` after building to detect drift; CI performs this offline without database credentials or workers. Representative schema/runtime agreement is tested, but full client acceptance remains pending.

