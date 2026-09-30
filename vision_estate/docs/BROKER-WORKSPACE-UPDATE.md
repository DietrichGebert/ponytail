# Broker workspace repair — 22 September 2026

The previous assignment selector displayed all staff, including inactive invitees, and immediately submitted on selection without a saving state. It also did not show the current owner. The server rejected inactive users, so the UI offered choices that could not succeed.

## Changes

- Assignment now loads the dedicated paginated staff endpoint, includes only active BROKER accounts, displays names and email addresses, and offers an explicit save action with loading, error, empty and success states. The current owner is shown, and the broker list can be refreshed after account activation.
- Server assignment locks the lead and selected staff row, rechecks active broker eligibility, returns a useful not-found response, and avoids duplicate assignment audit entries for unchanged ownership. Admin authorization remains required.
- Workspace has a navy header, summary cards, stage/ownership labels, clear filters, and the assignment panel at the top of lead actions. Error/loading states no longer display a misleading empty pipeline. Seller names retain their capitalization.
- Lead action controls remain disabled while refreshed data is loading. Dynamic text near sibling elements uses stable elements in additional affected areas.

## Verification

111 unit tests passed, including four new assignment regression cases, and 16 isolated API tests passed. Backend and frontend builds and lint passed, including a final frontend build/lint after the last UI adjustments. The real PostgreSQL broker workflow regression passed with synthetic records rolled back; no messages or provider calls were sent.

Authenticated visual assignment verification is pending: the available browser is at the login page. This is not a claim of zero errors or complete production readiness.

## Manual acceptance

1. Sign in as administrator, open a lead, and check its current owner.
2. Ensure only active brokers appear; pending invitees and administrators must not appear.
3. Select a different demo broker and press Save assignment. Check the success state, reload, and verify ownership persists.
4. Open the broker's separate browser profile and verify the assigned lead appears.
5. Save notes, change stage, search/filter and clear filters. Confirm saved changes persist and no runtime overlay appears.
6. With no eligible broker, check the explanatory empty state and Manage team link. Refresh the broker list after activation.
