import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { invitationToken, StaffInvitationsService } from './staff-invitations';
import { hashToken, verifyPassword } from './auth-crypto';
beforeEach(() =>
  vi.stubEnv(
    'AUTH_JWT_SECRET',
    'test-only-invitation-secret-over-32-characters',
  ),
);
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  const expiresAt = new Date(Date.now() + 60000),
    token = invitationToken('invite', expiresAt.getTime());
  const row: any = {
    id: 'invite',
    userId: 'broker',
    expiresAt,
    tokenHash: hashToken(token),
    user: { name: 'Broker', email: 'broker@example.invalid', active: false },
  };
  const repo: any = {
    findUniqueStaffInvitation: vi.fn(async () => row),
    lockStaffUser: vi.fn(),
    updateManyStaffInvitation: vi.fn().mockResolvedValue({ count: 1 }),
    updateUser: vi.fn(),
    createAuditLog: vi.fn(),
  };
  repo.transaction = async (fn) => fn(repo);
  return { row, repo, token, service: new StaffInvitationsService(repo) };
}
describe('Broker invitations', () => {
  it('inspection does not consume an invitation or expose its password/hash', async () => {
    const { repo, token, service } = fixture();
    expect(await service.inspect(token)).toEqual({
      name: 'Broker',
      email: 'broker@example.invalid',
      expiresAt: expect.any(Date),
    });
    expect(repo.updateManyStaffInvitation).not.toHaveBeenCalled();
  });
  it.each(['acceptedAt', 'revokedAt', 'expired', 'active', 'hash'])(
    'rejects %s invitations',
    async (reason) => {
      const { row, token, service } = fixture();
      if (reason === 'expired') row.expiresAt = new Date(0);
      else if (reason === 'active') row.user.active = true;
      else if (reason === 'hash') row.tokenHash = 'other';
      else row[reason] = new Date();
      await expect(service.inspect(token)).rejects.toThrow('invalid');
    },
  );
  it('rejects a signed but expired capability before database access', async () => {
    const { repo, service } = fixture();
    await expect(
      service.inspect(invitationToken('invite', Date.now() - 1)),
    ).rejects.toThrow('expired');
    expect(repo.findUniqueStaffInvitation).not.toHaveBeenCalled();
  });
  it('atomically consumes the token and hashes the chosen password', async () => {
    const { repo, service, token } = fixture();
    expect(
      await service.accept({ token, password: 'chosen-secure-password' }),
    ).toEqual({ state: 'VERIFIED' });
    const update = repo.updateUser.mock.calls[0][0];
    expect(update.data.active).toBe(true);
    expect(
      verifyPassword('chosen-secure-password', update.data.passwordHash),
    ).toBe(true);
    expect(repo.createAuditLog.mock.calls[0][0].data.action).toBe(
      'BROKER_EMAIL_VERIFIED',
    );
  });
  it('does not activate an account when another request already consumed the invitation', async () => {
    const { repo, service, token } = fixture();
    repo.updateManyStaffInvitation.mockResolvedValue({ count: 0 });
    await expect(
      service.accept({ token, password: 'chosen-secure-password' }),
    ).rejects.toThrow('no longer');
    expect(repo.updateUser).not.toHaveBeenCalled();
  });
  it('creates an inactive broker and queues only the invitation identifier', async () => {
    const repo: any = {
      createUser: vi
        .fn()
        .mockResolvedValue({ id: 'broker', email: 'broker@example.invalid' }),
      createStaffInvitation: vi.fn(),
      createNotification: vi.fn(),
      createAuditLog: vi.fn(),
    };
    repo.transaction = async (fn) => fn(repo);
    const result = await new StaffInvitationsService(repo).invite(
      { name: 'Broker', email: 'BROKER@example.invalid', locale: 'en' },
      { id: 'admin' } as any,
    );
    expect(repo.createUser.mock.calls[0][0].data).toMatchObject({
      role: 'BROKER',
      active: false,
      email: 'broker@example.invalid',
    });
    expect(repo.createNotification.mock.calls[0][0].data.payload).toEqual({
      invitationId: result.invitationId,
      locale: 'en',
      expiresAt: result.expiresAt.toISOString(),
    });
    expect(result).not.toHaveProperty('token');
  });
});
