import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth-service';
import { passwordHash } from './auth-crypto';

describe('Account deactivation during authentication', () => {
  it.each(['deactivated', 'password-changed'])(
    'does not mint a login session when the account was %s after password verification',
    async (reason) => {
      const user = {
        id: 'broker',
        active: true,
        passwordHash: passwordHash('correct-password'),
      };
      const tx = {
        lockStaffUser: vi.fn(),
        findUniqueUser: vi
          .fn()
          .mockResolvedValue({
            ...user,
            active: reason !== 'deactivated',
            passwordHash:
              reason === 'password-changed' ? 'different' : user.passwordHash,
          }),
        createSession: vi.fn(),
      };
      const repo = {
        findUniqueUser: vi.fn().mockResolvedValue(user),
        transaction: async (fn) => fn(tx),
      };
      await expect(
        new AuthService(repo as any).login({
          email: 'broker@example.invalid',
          password: 'correct-password',
        }),
      ).rejects.toThrow('incorrect');
      expect(tx.lockStaffUser).toHaveBeenCalledWith('broker');
      expect(tx.createSession).not.toHaveBeenCalled();
    },
  );
  it('does not refresh a session deleted by concurrent deactivation', async () => {
    const tx = {
      findUniqueSession: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'old',
          userId: 'broker',
          familyId: 'family',
        })
        .mockResolvedValueOnce(null),
      lockSessionFamily: vi.fn(),
      lockStaffUser: vi.fn(),
      createSession: vi.fn(),
    };
    const repo = { transaction: async (fn) => fn(tx) };
    await expect(
      new AuthService(repo as any).refresh('a'.repeat(64)),
    ).rejects.toThrow('sign in');
    expect(tx.lockStaffUser).toHaveBeenCalledWith('broker');
    expect(tx.createSession).not.toHaveBeenCalled();
  });
});
