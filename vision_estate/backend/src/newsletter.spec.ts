import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterService, consentCopy, newsletterToken } from './newsletter';
import { hashToken } from './auth-crypto';
import {
  valueSignalPayload,
  validateFullStrategy,
} from './properties/report-tiers';
describe('Newsletter capabilities and consent transitions', () => {
  beforeEach(() =>
    vi.stubEnv('NEWSLETTER_TOKEN_SECRET', 'test-only-secret-'.repeat(4)),
  );
  afterEach(() => vi.unstubAllEnvs());
  function fixture() {
    const repo: any = {
      updateManyNewsletterSubscription: vi.fn().mockResolvedValue({ count: 1 }),
      createConsent: vi.fn(),
      createAuditLog: vi.fn(),
    };
    repo.transaction = async (fn: any) => fn(repo);
    return { repo, service: new NewsletterService(repo) };
  }
  it('serves German by default and independent English consent copy', () => {
    expect(consentCopy().locale).toBe('de-DE');
    expect(consentCopy('en').newsletter).toContain('voluntary');
    expect(consentCopy('de-DE').newsletter).toContain('freiwillig');
    expect(consentCopy().processing).not.toBe(consentCopy().newsletter);
  });
  it('consumes a valid token atomically, clears its hash and records the confirming action', async () => {
    const { repo, service } = fixture();
    const token = newsletterToken(
      'subscription',
      'confirm',
      Date.now() + 60000,
    );
    await expect(service.confirm(token, '127.0.0.1')).resolves.toEqual({
      state: 'CONFIRMED',
    });
    expect(repo.updateManyNewsletterSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: 'PENDING',
          confirmTokenHash: hashToken(token),
        }),
        data: expect.objectContaining({
          state: 'CONFIRMED',
          confirmTokenHash: null,
        }),
      }),
    );
    expect(repo.createConsent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'DOUBLE_OPT_IN_LINK',
        action: 'GRANTED',
        ipAddress: hashToken('127.0.0.1'),
      }),
    });
  });
  it('rejects a used token without recording another consent', async () => {
    const { repo, service } = fixture();
    repo.updateManyNewsletterSubscription.mockResolvedValue({ count: 0 });
    await expect(
      service.confirm(newsletterToken('s', 'confirm', Date.now() + 60000), ''),
    ).rejects.toThrow('already been used');
    expect(repo.createConsent).not.toHaveBeenCalled();
  });
  it.each(['expired', 'tampered', 'wrong-purpose'])(
    'rejects %s links before database access',
    async (kind) => {
      const { repo, service } = fixture();
      let token = newsletterToken(
        's',
        kind === 'wrong-purpose' ? 'withdraw' : 'confirm',
        kind === 'expired' ? Date.now() - 1000 : Date.now() + 60000,
      );
      if (kind === 'tampered') token += 'x';
      await expect(service.confirm(token, '')).rejects.toThrow(
        'invalid or expired',
      );
      expect(repo.transaction).toBeDefined();
      expect(repo.updateManyNewsletterSubscription).not.toHaveBeenCalled();
    },
  );
  it('withdraws once, and repeated unsubscribe does not duplicate audit events', async () => {
    const { repo, service } = fixture();
    const token = newsletterToken('s', 'withdraw', 0);
    await service.unsubscribe(token, '');
    repo.updateManyNewsletterSubscription.mockResolvedValue({ count: 0 });
    await service.unsubscribe(token, '');
    expect(repo.createConsent).toHaveBeenCalledTimes(1);
    expect(repo.createConsent.mock.calls[0][0].data.action).toBe('WITHDRAWN');
  });
  it('never accepts a confirmation token for withdrawal', async () => {
    const { service } = fixture();
    await expect(
      service.unsubscribe(
        newsletterToken('s', 'confirm', Date.now() + 60000),
        '',
      ),
    ).rejects.toThrow('invalid');
  });
  it('expires pending tokens without deleting consent history', async () => {
    const { repo, service } = fixture();
    await service.expire();
    expect(repo.updateManyNewsletterSubscription.mock.calls[0][0].data).toEqual(
      { state: 'NONE', confirmTokenHash: null, confirmTokenExpiresAt: null },
    );
    expect(repo.createConsent).not.toHaveBeenCalled();
  });
});
describe('Report tier boundaries', () => {
  it('strips strategy and unknown fields even from legacy Value Signal rows', () => {
    const result = valueSignalPayload({
      provider: 'PriceHubble',
      valueRange: { low: 1, high: 2, currency: 'EUR' },
      recommendation: 'private pricing',
      buyerPositioning: 'private',
      salesRoute: 'private',
      strategy: ['private'],
      unknownSecret: 'private',
    });
    expect(result).toEqual({
      provider: 'PriceHubble',
      valueRange: { low: 1, high: 2, currency: 'EUR' },
      tier: 'VALUE_SIGNAL',
    });
  });
  it('requires real full-tier content and returns only approved fields', () => {
    expect(() =>
      validateFullStrategy({ recommendation: 'same as compact report' }),
    ).toThrow();
    expect(
      validateFullStrategy({
        buyerPositioning: 'context',
        salesRoute: 'route',
        strategy: ['step'],
        unexpected: 'discard',
      }),
    ).toEqual({
      buyerPositioning: 'context',
      salesRoute: 'route',
      strategy: ['step'],
    });
  });
});
