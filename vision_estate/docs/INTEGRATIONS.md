# Integration boundary contracts

The backend currently calls explicitly configured HTTPS gateways. These are extension points and **are not implementations of PriceHubble, Sprengnetter, Google Calendar, Microsoft 365, OpenAI, Anthropic or an email provider**. Do not put an arbitrary vendor endpoint in these variables: write and validate the selected vendor adapter first.

Use server-side secrets only. All gateway calls send Authorization: Bearer <configured key> and Idempotency-Key. Gateways must authenticate callers, validate requests, redact logs and deduplicate writes. Do not enable workers with live services until the staging contract tests and data-processing arrangements are complete.

## Valuation

Configuration: VALUATION_GATEWAY_URL / VALUATION_GATEWAY_KEY. Timeout: 20 seconds.

Request: propertyId, address, propertyType, sizeSqm, yearBuilt, condition, rooms, features, locale. Seller names/email/phone are excluded.

Required response:
```json
{
  "provider": "PriceHubble",
  "estimatedValue": 500000,
  "lowRange": 450000,
  "highRange": 550000,
  "currency": "EUR",
  "confidence": "MEDIUM",
  "asOf": "2026-09-11",
  "explanation": {
    "strengths": ["A statement grounded in supplied provider evidence"],
    "weaknesses": ["A specific limitation in the supplied evidence"],
    "marketSummary": "Only claims supported by the licensed data.",
    "recommendation": "A recommendation grounded in that range.",
    "nextSteps": ["Verify property documentation with the broker."]
  }
}
```

These numbers are **contract examples only**. Runtime code contains no sample valuation fallback. The gateway must call the licensed provider and preserve its raw response/evidence. Currently the application stores the normalized gateway response, so complete verbatim vendor provenance must be added to the final adapter contract. Range validation checks numeric types/order/currency/provider/confidence/date. It does not independently establish that the gateway genuinely contacted the vendor.

Explanation is optional. When unavailable, the report explicitly uses a factual fallback. A direct provider-independent AI implementation still needs to be built; AI text cannot replace numeric valuation fields. Prompt-injection resistance, evidence grounding and output evaluation must be tested in that adapter.

Failure: property remains VALUATION_PENDING with a visible processing error. Authorized brokers can request retry. No fabricated or stale unlabelled value is shown. Redis caching/backoff and validated stale-result handling remain future work.

## Calendar

Configuration: CALENDAR_GATEWAY_URL / CALENDAR_GATEWAY_KEY. Timeout: 15 seconds.

Request: bookingId, brokerId, startsAt, endsAt (UTC). The gateway maps brokerId to an authorized calendar and checks actual provider availability before writing. Return only after the provider confirms:
```json
{ "status": "CONFIRMED", "eventId": "real-calendar-event-id" }
```

The unique application slot and serializable transaction prevent duplicate local claims. The external gateway must additionally prevent overlap with events created outside this application. The calendar event request deliberately does not send seller PII.

No calendar success means no confirmed booking and no confirmation email. Ambiguous failures become CALENDAR_REVIEW_REQUIRED; do not blindly repeat them with a new idempotency key. Reconcile with the provider first. External free/busy sync, time changes, cancellation, cancellation emails and reconciliation actions are not implemented yet.

## Email

Configuration: EMAIL_GATEWAY_URL / EMAIL_GATEWAY_KEY; optional BROKER_NOTIFICATION_EMAIL receives new-lead notifications.

Request: kind (NEW_LEAD or BOOKING_CONFIRMED), recipient, payload. Response:
```json
{ "accepted": true }
```

A provider acceptance is not proof of inbox delivery. Implement bounce/webhook processing in the final adapter. Queue retries run at the worker interval up to five attempts; permanent failures appear in the admin queue. Production exponential backoff, suppression handling and manual retry UI remain open. Newsletter enrollment is disabled rather than pretending to perform double opt-in.

# Blueprint v3 additions (20 September 2026)

Newsletter delivery uses NEWSLETTER_EMAIL_GATEWAY_URL/KEY separately from transactional EMAIL_GATEWAY_URL/KEY. Workers are disabled in the example configuration until delivery is intentionally configured and verified. PUBLIC_APP_URL must be an HTTPS frontend origin, and NEWSLETTER_TOKEN_SECRET must contain at least 32 random characters. A pending subscription is not permission to send newsletters: only a confirmed live subscription is eligible. Confirmation jobs retain subscription identifiers/locale/expiry, not raw bearer tokens. The worker reconstructs a signed 48-hour purpose-bound token, stores its hash, and delivers a fragment-based frontend link. Confirmation requires an explicit user action on that page. Sender keys and signing material must be kept in managed secrets in production.

The licensed valuation gateway may include fullReport: {buyerPositioning: string, salesRoute: string, strategy: string[]}. Invalid/missing full strategy never blocks a valid compact report. A FULL_REPORT_GENERATION job waits for AI_REPORT_GATEWAY_URL/KEY and retries independently using stored valuation evidence and versioned German/English full-report prompt templates. The AI gateway must return precisely those strategy fields; it is not a replacement for a licensed valuation adapter. The gateway and templates are an integration contract, not a claim that a direct AI vendor, failover or cost governance is operational. Transactional email jobs now include VALUE_SIGNAL_READY and FULL_REPORT_RELEASED with property/report identifiers and locale; no cross-device report-access token is fabricated.
