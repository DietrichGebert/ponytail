import { describe, it, expect, vi } from 'vitest';
import { RecordsService, PropertyRecordsController } from './records';
import { cursorPage, cursorWhere } from './cursor';
describe('Cursor pagination and evidence access', () => {
  it('does not return quarantined legacy valuation amounts', async () => {
    const legacy = {
      provider: 'LEGACY_UNVERIFIED',
      estimatedValue: 123,
      lowRange: 100,
      highRange: 150,
    };
    const repo = {
      findFirstValuation: vi.fn(async ({ where }) =>
        where.provider?.not === legacy.provider ? null : legacy,
      ),
    };
    const properties = { authorize: vi.fn() };
    const controller = new PropertyRecordsController(
      repo as any,
      properties as any,
    );
    await expect(
      controller.valuation('property', 'owner-token', {} as any),
    ).rejects.toThrow('being prepared');
  });
  it('does not read valuation data when property authorization fails', async () => {
    const repo = { findFirstValuation: vi.fn() };
    const properties = {
      authorize: vi.fn().mockRejectedValue(new Error('Private property')),
    };
    await expect(
      new PropertyRecordsController(repo as any, properties as any).valuation(
        'property',
        'wrong',
        {} as any,
      ),
    ).rejects.toThrow('Private');
    expect(repo.findFirstValuation).not.toHaveBeenCalled();
  });
  it('uses timestamp and id for deterministic boundaries', () => {
    const rows = [
      {
        id: '00000000-0000-4000-8000-000000000002',
        createdAt: new Date('2026-09-21T00:00:00Z'),
      },
      {
        id: '00000000-0000-4000-8000-000000000001',
        createdAt: new Date('2026-09-21T00:00:00Z'),
      },
    ];
    const page = cursorPage(rows, 1);
    expect(page.data).toHaveLength(1);
    expect(cursorWhere({ limit: 1, cursor: page.nextCursor })).toEqual({
      OR: [
        { createdAt: { lt: rows[0].createdAt } },
        { createdAt: rows[0].createdAt, id: { lt: rows[0].id } },
      ],
    });
    expect(cursorPage(rows, 2).nextCursor).toBeNull();
  });
  it.each([
    'garbage',
    '====',
    Buffer.from('{"v":1,"id":"bad","at":"bad"}').toString('base64url'),
  ])('rejects malformed cursor %s', (cursor) => {
    expect(() => cursorWhere({ cursor, limit: 25 })).toThrow(
      'Invalid pagination',
    );
  });
  it('denies consent evidence belonging to another broker', async () => {
    const repo = {
      findUniqueLead: vi.fn().mockResolvedValue({ assignedToId: 'other' }),
      findManyConsent: vi.fn(),
    };
    await expect(
      new RecordsService(repo as any).consents('property', { limit: 25 }, {
        id: 'broker',
        role: 'BROKER',
      } as any),
    ).rejects.toThrow('restricted');
    expect(repo.findManyConsent).not.toHaveBeenCalled();
  });
  it('returns only selected consent evidence and audits access', async () => {
    const repo = {
      findUniqueLead: vi.fn().mockResolvedValue({ assignedToId: 'broker' }),
      findManyConsent: vi.fn().mockResolvedValue([]),
      createAuditLog: vi.fn(),
    };
    await new RecordsService(repo as any).consents('property', { limit: 25 }, {
      id: 'broker',
      role: 'BROKER',
    } as any);
    expect(repo.findManyConsent.mock.calls[0][0].select).not.toHaveProperty(
      'ipAddress',
    );
    expect(repo.findManyConsent.mock.calls[0][0].where.userId).toBe('property');
    expect(repo.createAuditLog).toHaveBeenCalledOnce();
  });
});
