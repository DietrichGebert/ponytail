import { describe, expect, it, vi } from 'vitest';
import { PropertyWorkflowService } from './properties/property-workflow-service';
function fixture(jobs: any[] = [], claimed = 1) {
  const repo: any = {
    findUniqueLead: vi
      .fn()
      .mockResolvedValue({
        id: 'lead',
        propertyId: 'property',
        assignedToId: 'broker',
      }),
    findUniqueProperty: vi.fn().mockResolvedValue({ state: 'REPORT_READY' }),
    findManyNotification: vi.fn().mockResolvedValue(jobs),
    lockLead: vi.fn(),
    updateManyNotification: vi.fn().mockResolvedValue({ count: claimed }),
    createAuditLog: vi.fn(),
  };
  repo.transaction = async (fn) => fn(repo);
  return {
    repo,
    service: new PropertyWorkflowService({} as any, repo, {} as any),
  };
}
describe('Truthful report retry status', () => {
  const broker = { id: 'broker', role: 'BROKER' } as any;
  it('does not claim to queue work when no failed generation exists', async () => {
    const { repo, service } = fixture();
    expect(await service.retry('lead', broker)).toEqual({ queued: false });
    expect(repo.updateManyNotification).not.toHaveBeenCalled();
  });
  it('does not reset a job already claimed by another request', async () => {
    const { repo, service } = fixture([{ id: 'job' }], 0);
    expect(await service.retry('lead', broker)).toEqual({ queued: false });
    expect(repo.createAuditLog).not.toHaveBeenCalled();
    expect(repo.updateManyNotification.mock.calls[0][0].where.state).toBe(
      'FAILED',
    );
  });
  it('records a successful requeue only after claiming the failed job', async () => {
    const { repo, service } = fixture([{ id: 'job' }]);
    expect(await service.retry('lead', broker)).toEqual({ queued: true });
    expect(repo.createAuditLog).toHaveBeenCalledOnce();
  });
});
