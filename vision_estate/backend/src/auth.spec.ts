import { describe, it, expect, vi } from 'vitest';
import { AuthGuard, AdminGuard, passwordHash, verifyPassword } from './auth';
describe('Authentication and roles', () => {
  it('salts passwords and verifies only the right password', () => {
    const a = passwordHash('correct-password');
    expect(a).not.toBe(passwordHash('correct-password'));
    expect(verifyPassword('correct-password', a)).toBe(true);
    expect(verifyPassword('wrong', a)).toBe(false);
  });
  it('rejects anonymous requests', async () => {
    const guard = new AuthGuard({
      session: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any);
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as any),
    ).rejects.toThrow('sign in');
  });
  it('rejects brokers from admin actions', () =>
    expect(() =>
      new AdminGuard().canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: 'BROKER' } }),
        }),
      } as any),
    ).toThrow('Administrator'));
});
