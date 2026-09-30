# Database diagnosis

## Resolved — 12 September 2026

User approved backup verification and database upgrade. Full Prisma comparison found no drift against the original baseline. A consistent seven-table data backup and baseline DDL were saved under `backend/.temp/pre-upgrade-2026-09-12T05-31-26-774Z/` (private data; excluded by backend .gitignore). Backup data SHA-256: `97d17651f4c815b4fe540f55cbcc5ac0198bfe14189bdeb07534698826685dff`. Every table was restored and compared in a temporary isolated schema; workflow migration passed there with all original row counts preserved. The rehearsal transaction was rolled back.

Baseline was then registered and workflow migration deployed successfully. A second Prisma comparison found no drift against the current application schema. Backend readiness returned 200. The real assessment service passed a PostgreSQL transaction test of creation, idempotent retry, ownership authorization, lead/consent/audit creation; all synthetic writes were rolled back and absence verified. No email was sent by that test.

The approved migration marks existing reports/valuations for reassessment as described below. It does not supply a licensed valuation integration or create login accounts. Active frontend is now http://localhost:3000; previous port 3100 preview is stopped.

## Earlier diagnosis (superseded by resolution above)

Read-only inspection confirmed that the configured database is reachable outside the restricted execution sandbox. The sandbox connection returned Prisma P1001; that does not establish a database outage.

The database contains the original seven application tables and no `_prisma_migrations` table. The current application additionally requires User, Session, AvailabilitySlot, Booking and Notification. Property lacks accessTokenHash, submissionKey, submissionHash, rooms, features, sellingTimeline and processingError. Lead lacks score, scoreVersion, scoreReasons, assignedToId and notes. These missing columns/tables explain failures of current assessment and authentication queries.

No database records, schema or migration history were changed. A subsequent full Prisma baseline comparison was declined, so exact index/constraint/enum compatibility remains unverified.

## Repair prepared for review

1. Confirm a restorable backup or isolated database clone.
2. Complete the read-only comparison against `backend/tmp/baseline.prisma`; resolve any drift before baselining.
3. Mark the existing baseline as applied only after the comparison passes.
4. Test and apply `backend/prisma/migrations/202609110002_secure_workflow/migration.sql`.
5. Check schema compatibility and assessment creation on the isolated clone before client use.

The existing migration adds five tables, property ownership/idempotency fields and lead scoring/assignment fields. It also changes ALL existing valuations to LEGACY_UNVERIFIED/stale, hides existing reports, marks properties for reassessment, resets lead score metadata and clears broker review fields. Those record changes require explicit review; they must not be described as a schema-only update. Existing records are not deleted. Do not run a reset or blindly deploy the baseline onto the existing tables.
