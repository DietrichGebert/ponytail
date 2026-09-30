import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { AuthService } from './auth-service';
import { AuthGuard } from './auth';
import { hashToken } from './auth-crypto';
import { issueAccessToken, verifyAccessToken } from './access-token';

const secret = 'test-only-signing-key-at-least-32-characters';
beforeEach(() => vi.stubEnv('AUTH_JWT_SECRET', secret));
afterEach(() => vi.unstubAllEnvs());
describe('JWT boundary', () => {
  it('validates identity/session claims and rejects tampering', async () => {
    const jwt = await issueAccessToken('user', 'session');
    expect(await verifyAccessToken(jwt)).toEqual({
      userId: 'user',
      sessionId: 'session',
    });
    const parts = jwt.split('.');
    parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString(
      'base64url',
    );
    await expect(verifyAccessToken(parts.join('.'))).rejects.toThrow('sign in');
  });
  it.each(['expired', 'audience', 'algorithm'])(
    'rejects %s tokens',
    async (reason) => {
      const jwt = await new SignJWT({ sid: 'session' })
        .setProtectedHeader({
          alg: reason === 'algorithm' ? 'HS384' : 'HS256',
          typ: 'JWT',
        })
        .setSubject('user')
        .setIssuer('vision-estates')
        .setAudience(
          reason === 'audience' ? 'another-app' : 'vision-estates-api',
        )
        .setJti('test')
        .setIssuedAt()
        .setExpirationTime(
          reason === 'expired' ? Math.floor(Date.now() / 1000) - 1 : '10m',
        )
        .sign(new TextEncoder().encode(secret));
      await expect(verifyAccessToken(jwt)).rejects.toThrow('sign in');
    },
  );
  it('fails closed with a missing signing key', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', '');
    await expect(issueAccessToken('user', 'session')).rejects.toThrow(
      'signing key',
    );
  });
  it.each(['revokedAt', 'consumedAt', 'inactive'])(
    'rejects %s sessions even with valid JWT',
    async (field) => {
      const token = await issueAccessToken('user', 'session');
      const session = {
        familyId: 'family',
        userId: 'user',
        expiresAt: new Date(Date.now() + 60000),
        user: { active: field !== 'inactive' },
        [field]: new Date(),
      };
      const guard = new AuthGuard({
        findUniqueSession: vi.fn().mockResolvedValue(session),
      } as any);
      await expect(
        guard.canActivate({
          switchToHttp: () => ({
            getRequest: () => ({
              headers: { authorization: `Bearer ${token}` },
            }),
          }),
        } as any),
      ).rejects.toThrow('sign in');
    },
  );
});
describe('Refresh rotation', () => {
  function setup(claimed = 1) {
    const token = 'a'.repeat(64);
    const old = {
      id: 'old',
      userId: 'user',
      familyId: 'family',
      expiresAt: new Date(Date.now() + 60000),
      user: { id: 'user', name: 'Broker', role: 'BROKER', active: true },
    };
    const tx = {
      lockSessionFamily: vi.fn(),
      lockStaffUser: vi.fn(),
      findUniqueSession: vi.fn().mockResolvedValue(old),
      updateManySession: vi.fn().mockResolvedValue({ count: claimed }),
      createSession: vi.fn(),
      createAuditLog: vi.fn(),
    };
    const repository = { ...tx, transaction: vi.fn(async (fn) => fn(tx)) };
    return { tx, old, token, service: new AuthService(repository as any) };
  }
  it('issues a different hashed token with the same family and absolute expiry', async () => {
    const { tx, old, token, service } = setup();
    const result = await service.refresh(token);
    expect(result.token).not.toBe(token);
    expect(tx.createSession).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familyId: old.familyId,
        expiresAt: old.expiresAt,
        tokenHash: hashToken(result.token),
      }),
    });
    expect(await verifyAccessToken(result.accessToken)).toMatchObject({
      userId: 'user',
    });
  });
  it('commits family revocation on reuse and does not create another session', async () => {
    const { tx, service, token } = setup(0);
    await expect(service.refresh(token)).rejects.toThrow('sign in');
    expect(tx.updateManySession).toHaveBeenLastCalledWith({
      where: { familyId: 'family' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.createAuditLog).toHaveBeenCalledOnce();
    expect(tx.createSession).not.toHaveBeenCalled();
  });
  it('rejects expired refresh tokens', async () => {
    const { old, tx, service, token } = setup();
    old.expiresAt = new Date(0);
    await expect(service.refresh(token)).rejects.toThrow('sign in');
    expect(tx.createSession).not.toHaveBeenCalled();
  });
  it('revokes all family members on logout', async () => {
    const { tx, service, token } = setup();
    await service.logout(token);
    expect(tx.updateManySession).toHaveBeenCalledWith({
      where: { familyId: 'family' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
