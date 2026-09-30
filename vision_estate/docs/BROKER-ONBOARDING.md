# Broker onboarding — 21 September 2026

The implemented approach is administrator invitation, not unrestricted public staff signup. Blueprint v3 specifies broker/admin login and user management; verified invitation onboarding is an additional requested improvement.

## Administrator flow

1. Sign in at `/broker/login` using an existing administrator account.
2. Open `/admin` and use **Invite a broker** with the broker's name and work email.
3. The account is created inactive and the invitation email is queued. QUEUED does not mean delivered. No initial password needs to be shared or written in code.
4. Pending users show **Reissue invitation** and **Revoke invitation**. Reissuing invalidates previous links and gives the new invitation 48 hours. Reissued email currently uses German.
5. After verification, the ordinary deactivate/reactivate control is available. Deactivation revokes login sessions. Pending invitations cannot be activated with that control.

## Broker flow

1. Open the personal email link to `/broker/signup#token=...`.
2. The page validates the link and shows the invited identity, but opening the link alone does not activate the account.
3. Choose and confirm a password of 12–128 characters, then select **Verify email and activate account**.
4. Sign in at `/broker/login`. Only assigned seller records are visible.

Opening `/broker/signup` without a valid invitation explains how to get access; it does not provide a way to claim a staff role. An expired, revoked, consumed or superseded invitation cannot activate the account. Verification proves control of the invited mailbox; it is not professional-license/KYC verification.

## Delivery requirements

`AUTH_JWT_SECRET` must contain at least 32 random characters; keep it private and stable. Configure the transactional `EMAIL_GATEWAY_URL` / `EMAIL_GATEWAY_KEY` and an HTTPS `PUBLIC_APP_URL`. The gateway receives kind `BROKER_INVITATION`, recipient and a localized payload with `invitationUrl`, `subject`, `message`. It must return `{ "accepted": true }` only after accepting delivery. `WORKERS_ENABLED` remains false locally, so current tests send nothing.

The database stores the invitation token hash and the queued invitation identifier/expiry, not the bearer link. The worker reconstructs the purpose-bound capability and cancels jobs for outdated or unavailable invitations. Actual inbox receipt remains an integration acceptance test; no successful delivery is claimed from the queue alone.

## Authentication and operations

New staff sessions use 10-minute HS256 JWT access tokens and single-use rotating refresh tokens with a seven-day absolute expiry. Both browser cookies are HttpOnly, SameSite=Strict and Secure in production; access tokens are also accepted as Bearer credentials. Reuse of an old refresh token revokes its family. Logout uses DELETE `/v1/auth/session`; POST `/v1/auth/logout` is retained for compatibility. Old opaque sessions expire on their original eight-hour schedule.

Password recovery, MFA, public registration with admin approval, managed signing-key rotation and actual email delivery verification remain separate work. Existing direct admin account creation remains available for compatibility; it does not claim email verification.
