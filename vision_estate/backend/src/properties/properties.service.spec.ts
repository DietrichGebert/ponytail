import { ApplicationRepository } from '../application.repository';
import { describe, it, expect, vi } from 'vitest';
import { PropertiesService } from './properties.service';
import { hashToken } from '../auth';
const dto = {
  address: { street: 'Test 1', postalCode: '80331', city: 'Munich' },
  propertyType: 'HOUSE',
  sizeSqm: 100,
  condition: 'GOOD',
  yearBuilt: 2000,
  sellerContact: { name: 'Test Seller', email: 'test@example.com' },
  dataProcessingConsent: true,
} as any;
describe('Property intake safeguards', () => {
  it('denies a report when no access token exists on a legacy record', async () => {
    const s = new PropertiesService(
      new ApplicationRepository({
        property: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'legacy', accessTokenHash: null }),
        },
      } as any),
    );
    await expect(s.authorize('legacy', '')).rejects.toThrow('private');
  });
  it('denies a different seller access', async () => {
    const s = new PropertiesService(
      new ApplicationRepository({
        property: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ accessTokenHash: hashToken('owner') }),
        },
      } as any),
    );
    await expect(s.authorize('id', 'attacker')).rejects.toThrow('private');
  });
  it('requires an idempotency key before touching the database', async () => {
    const s = new PropertiesService(new ApplicationRepository({} as any));
    await expect(s.create(dto, '', '', 'a'.repeat(64))).rejects.toThrow(
      'idempotency',
    );
  });
  it('rejects a replay with changed data', async () => {
    const s = new PropertiesService(
      new ApplicationRepository({
        property: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ submissionHash: 'different' }),
        },
      } as any),
    );
    await expect(
      s.create(dto, '', 'valid-submission-key', 'a'.repeat(64)),
    ).rejects.toThrow('different data');
  });
  it('replays the original result without creating another lead', async () => {
    const token = 'a'.repeat(64);
    const s = new PropertiesService(
      new ApplicationRepository({
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'same',
            state: 'SUBMITTED',
            submissionHash: hashToken(JSON.stringify(dto)),
            accessTokenHash: hashToken(token),
          }),
        },
      } as any),
    );
    await expect(
      s.create(dto, '', 'valid-submission-key', token),
    ).resolves.toEqual({ id: 'same', state: 'SUBMITTED' });
  });
});
