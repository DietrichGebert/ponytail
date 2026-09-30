# Operations and handover

## Environment boundaries

Existing backend .env was preserved and not displayed. No migration was executed against that configured database. Use an isolated PostgreSQL instance first. Docker is not installed/available in the inspected shell; container builds and compose startup were not verified here.

Backend defaults to loopback:3001, frontend defaults to :3000. Keep the backend private behind the Next.js proxy. In a container set HOST=0.0.0.0 but do not expose its port publicly. Configure APP_ORIGIN to the real frontend origin. Use HTTPS and Secure cookies in staging/production. Configure TLS/HSTS, CSP/nonces and request limits at the deployment edge before launch.

The in-memory write limiter is a single-instance safeguard. Because the API is behind a proxy, it may group users under the proxy address. Replace it with verified-client-IP edge limits plus shared per-account limits before public traffic or horizontal scaling. Never simply trust arbitrary X-Forwarded-For headers.

## First administrator

Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (12+ characters), and optional BOOTSTRAP_ADMIN_NAME in the local environment. Run npm run admin:create from backend after migrations. This never overwrites an existing account. Remove bootstrap secrets afterwards.

Admin creates users and assigns leads at /admin and /broker/leads. New brokers see no leads until assignment. There is no self-registration or shipped default password. Password reset/invitations/first-login password rotation remain implementation work, not a hidden feature.

## Valuation outage

Check configuration presence, worker enablement and processingError. No number is shown without a valid licensed response. Fix the adapter/configuration, then use Retry valuation on the authorized lead detail. Do not replace the missing licensed value with a local heuristic.

Legacy migration flags old fixed-rate valuations as unverified and hides their reports. Keep the original database backup for forensic comparison. Do not release legacy reports as though they were new licensed outputs.

## Calendar incident

CALENDAR_REVIEW_REQUIRED means the external write failed or was ambiguous. Check the external calendar by the booking idempotency key and event evidence. Do not promise a confirmed appointment or retry under a different booking identity. A reconciliation UI and cancellation/rescheduling are still needed before launch.

## Email incident

Admin shows PENDING/SENT/FAILED counts. Missing email configuration leaves jobs queued. Five failed attempts mark a job FAILED. Gateway acceptance does not establish final delivery. Implement verified domain configuration, webhook/bounce handling and a reviewed replay procedure before launch.

## Backups and deployment

1. Review migrations on an isolated PostgreSQL instance.
2. Verify a recent backup and restore it to a separate staging database.
3. Rehearse baseline resolution only if the restored schema matches the original baseline.
4. Apply migrations, run full database-backed acceptance tests and verify record counts/legacy quarantine.
5. Build immutable images and run readiness checks.
6. Deploy a new application revision alongside the active revision.
7. Switch traffic only after real-provider smoke tests and client approval.
8. Roll traffic back on regression; additive database changes can remain. Never undo database migrations with destructive reset commands.

The blue-green infrastructure and automated traffic rollback are not included as provisioned resources. They require the client's AWS project and deployment design.

## Validation scope

Unit and isolated API tests cover core logic/access rejection. Desktop/mobile browser checks cover the public UI and intake validation. Database migration application, real provider responses, authenticated dashboard journeys, simultaneous reservations, Docker, CI execution, load testing, external notifications and production deployment remain unverified.

## Documentation maintenance

Update REVIEW-AND-ROADMAP.md as gaps close. Record actual provider/schema versions, evidence sources, reviewed scoring rules, retention period, infrastructure owner, incident contact and restore rehearsal date. Do not mark proposal Appendix E complete merely because application builds pass.

