import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryWorker } from './delivery-worker';
import { invitationToken } from './staff-invitations';
import { hashToken } from './auth-crypto';
beforeEach(() => {
  vi.stubEnv('AUTH_JWT_SECRET', 'unit-test-secret-32-characters-or-more');
  vi.stubEnv('EMAIL_GATEWAY_URL', 'https://mail.example.invalid');
  vi.stubEnv('EMAIL_GATEWAY_KEY', 'test');
  vi.stubEnv('PUBLIC_APP_URL', 'https://app.example.invalid');
  vi.stubEnv('NEWSLETTER_EMAIL_GATEWAY_URL', '');
  vi.stubEnv('CALENDAR_GATEWAY_URL', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function fixture() {
  const expiresAt = new Date(Date.now() + 60000),
    token = invitationToken('invite', expiresAt.getTime());
  const invite: any = {
    id: 'invite',
    expiresAt,
    tokenHash: hashToken(token),
    user: { active: false, email: 'broker@example.invalid' },
  };
  const job = {
    id: 'job',
    kind: 'BROKER_INVITATION',
    recipient: invite.user.email,
    attempts: 0,
    payload: {
      invitationId: invite.id,
      locale: 'en',
      expiresAt: expiresAt.toISOString(),
    },
  };
  const repo: any = {
    updateManyNewsletterSubscription: vi.fn(),
    findManyNotification: vi.fn().mockResolvedValue([job]),
    findUniqueStaffInvitation: vi.fn().mockResolvedValue(invite),
    updateNotification: vi.fn(),
  };
  const send = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) });
  vi.stubGlobal('fetch', send);
  return { invite, job, repo, send, worker: new DeliveryWorker(repo) };
}
describe('Invitation delivery', () => {
  it('sends a purpose-bound fragment link through the transactional transport', async () => {
    const { send, worker } = fixture();
    await worker.tick();
    const body = JSON.parse(send.mock.calls[0][1].body);
    expect(body.kind).toBe('BROKER_INVITATION');
    expect(body.payload.invitationUrl).toContain('/broker/signup#token=');
    expect(body.payload.subject).toBe('Your Vision Estates broker invitation');
  });
  it.each(['revoked', 'superseded', 'accepted'])(
    'cancels %s invitation jobs',
    async (reason) => {
      const { invite, job, repo, send, worker } = fixture();
      if (reason === 'revoked') invite.revokedAt = new Date();
      else if (reason === 'accepted') invite.acceptedAt = new Date();
      else job.payload.expiresAt = new Date(0).toISOString();
      await worker.tick();
      expect(send).not.toHaveBeenCalled();
      expect(repo.updateNotification).toHaveBeenCalledWith({
        where: { id: 'job' },
        data: { state: 'CANCELLED' },
      });
    },
  );
  it('leaves delivery pending without a secure public URL', async () => {
    const { send, repo, worker } = fixture();
    vi.stubEnv('PUBLIC_APP_URL', 'http://localhost:3000');
    await worker.tick();
    expect(send).not.toHaveBeenCalled();
    expect(repo.updateNotification).not.toHaveBeenCalled();
  });
});
