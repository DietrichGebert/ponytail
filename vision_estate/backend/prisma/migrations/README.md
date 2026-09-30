# Database migration safety

21 September 2026: `202609200001_rotating_sessions`, `202609210001_report_invariants` and `202609210002_broker_invitations` were rehearsed in rollback schemas and applied. Existing data was preserved. Private verified backups are in `.temp/auth-upgrade-*` and `.temp/report-upgrade-*` (never publish these). The report rehearsal restored and compared affected table backups, then checked database rejection of unreviewed release, evidence mutation and release reversal. The legacy release-attribution FK uses NOT VALID: new writes are checked, historical invalid IDs require reconciliation before validation. New reviewed report payloads are immutable. Do not rebaseline or reset this database.

12 September 2026: the supplied database has now been backed up, compared successfully against the original baseline, baselined and upgraded with user approval. Restore and migration rehearsal passed in an isolated temporary schema. Final schema comparison passed. See ../../../docs/DATABASE-DIAGNOSIS.md for evidence and the private backup location. The unexecuted status recorded below is historical; do not baseline this database again.

There was no migration history in the supplied project.

- Empty database: run `prisma migrate deploy` to apply the baseline and the workflow migration.
- Existing database created from the ORIGINAL schema: back it up and verify it matches `tmp/baseline.prisma` first. Only then mark `202609110001_baseline` as applied with `prisma migrate resolve --applied 202609110001_baseline`, and run `prisma migrate deploy`.
- A different existing schema needs a reviewed drift reconciliation. Do not mark the baseline blindly.
- Never run `migrate reset` or `db push --accept-data-loss` against client data.

The workflow migration preserves all records but quarantines legacy valuations/reports, because the old implementation fabricated provider values. They become LEGACY_UNVERIFIED / DRAFT_INTERNAL and require reassessment. Leads become legacy-unscored; administrators must assign a broker. Legacy report URLs have no ownership token and are intentionally denied to anonymous callers.

The preceding original-baseline instructions are historical. For a different existing database, compare drift and test a backup clone before applying migrations. Never assume its migration history matches this development database.

