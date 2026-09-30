import { describe, it, expect, vi } from 'vitest';
import { PropertyWorkflowService } from './property-workflow-service';
import { ApplicationRepository } from '../application.repository';
describe('Broker report release', () => {
  it('rejects release without a recorded review', async () => {
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue({
          tier: 'FULL',
          property: { state: 'REPORT_READY', lead: { id: 'lead' } },
        }),
      },
      lead: {
        findUnique: vi.fn().mockResolvedValue({ id: 'lead', reviewedAt: null }),
      },
    };
    const c = new PropertyWorkflowService(
      {} as any,
      new ApplicationRepository(prisma as any),
      {} as any,
    );
    await expect(
      c.release('report', { id: 'admin', role: 'ADMIN' } as any),
    ).rejects.toThrow('Record your broker review');
  });
  it('rejects access to another brokers lead', async () => {
    const prisma = {
      lead: {
        findUnique: vi.fn().mockResolvedValue({ assignedToId: 'other' }),
      },
    };
    const c = new PropertyWorkflowService(
      {} as any,
      new ApplicationRepository(prisma as any),
      {} as any,
    );
    await expect(
      c.review('lead', { id: 'broker', role: 'BROKER' } as any),
    ).rejects.toThrow('another broker');
  });
});
