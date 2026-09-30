import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin-service';
import { AuthService } from './auth-service';
import { BookingService } from './booking-service';
import { ApplicationRepository } from './application.repository';
import { passwordHash, hashToken } from './auth-crypto';

describe('Service extraction preserves behavior', () => {
  it('attributes account creation to the acting admin, not the created user', async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'new-user',
          name: 'Broker',
          email: 'broker@example.invalid',
          role: 'BROKER',
        }),
      },
      auditLog: { create: vi.fn() },
    };
    const db = { $transaction: async (fn) => fn(tx) };
    const result = await new AdminService(
      new ApplicationRepository(db as any),
    ).create(
      {
        name: 'Broker',
        email: 'BROKER@example.invalid',
        password: 'strong-password',
        role: 'BROKER',
      },
      { id: 'acting-admin' } as any,
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'acting-admin',
        entityId: 'new-user',
      }),
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(tx.user.create.mock.calls[0][0].data.passwordHash).not.toBe(
      'strong-password',
    );
  });
  it('creates only a hashed session and returns a public identity on login', async () => {
    vi.stubEnv(
      'AUTH_JWT_SECRET',
      'unit-test-only-secret-not-for-production-123456',
    );
    const db = {
      $queryRaw: vi.fn(),
      $transaction: async (fn) => fn(db),
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'id',
          name: 'Broker',
          role: 'BROKER',
          active: true,
          passwordHash: passwordHash('correct-password'),
        }),
      },
      session: { create: vi.fn() },
    };
    const result = await new AuthService(
      new ApplicationRepository(db as any),
    ).login({ email: 'broker@example.invalid', password: 'correct-password' });
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(db.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: hashToken(result.token),
        userId: 'id',
      }),
    });
    expect(result.identity).toEqual({
      id: 'id',
      name: 'Broker',
      role: 'BROKER',
    });
  });
  it('rejects past availability before accessing the repository', async () => {
    const service = new BookingService({} as any, {} as any);
    await expect(
      service.slot(
        { startsAt: '2000-01-01T10:00:00Z', endsAt: '2000-01-01T11:00:00Z' },
        { id: 'broker' } as any,
      ),
    ).rejects.toThrow('future slot');
  });
});
