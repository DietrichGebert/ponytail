import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin-service';

function setup(user: object | null = { id: 'broker' }, lead: object | null = { id: 'lead', assignedToId: null }) {
  const tx = {
    lockLead: vi.fn(), lockStaffUser: vi.fn(),
    findUniqueLead: vi.fn().mockResolvedValue(lead),
    findFirstUser: vi.fn().mockResolvedValue(user),
    updateLead: vi.fn().mockResolvedValue({ id: 'lead', assignedToId: 'broker' }),
    createAuditLog: vi.fn(),
  };
  const service = new AdminService({ transaction: (fn) => fn(tx) } as any);
  const assign = () => service.assign('lead', { brokerId: 'broker' }, { id: 'admin', role: 'ADMIN' } as any);
  return { tx, assign };
}

describe('Lead assignment', () => {
  it('checks broker eligibility inside the locked transaction and records the actor', async () => {
    const { tx, assign } = setup();
    await assign();
    expect(tx.findFirstUser).toHaveBeenCalledWith({ where: { id: 'broker', active: true, role: 'BROKER' } });
    expect(tx.lockStaffUser.mock.invocationCallOrder[0]).toBeLessThan(tx.findFirstUser.mock.invocationCallOrder[0]);
    expect(tx.createAuditLog).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: 'admin', action: 'LEAD_ASSIGNED', metadata: { brokerId: 'broker' } }) });
  });
  it('rejects a broker who was deactivated before the assignment lock', async () => {
    const { tx, assign } = setup(null);
    await expect(assign()).rejects.toThrow('active, verified broker');
    expect(tx.updateLead).not.toHaveBeenCalled();
    expect(tx.createAuditLog).not.toHaveBeenCalled();
  });
  it('returns a useful not-found error for a removed lead', async () => {
    const { tx, assign } = setup({ id: 'broker' }, null);
    await expect(assign()).rejects.toThrow('no longer exists');
    expect(tx.updateLead).not.toHaveBeenCalled();
  });
  it('does not duplicate audit activity when the same assignment is submitted twice', async () => {
    const { tx, assign } = setup({ id: 'broker' }, { id: 'lead', assignedToId: 'broker' });
    await expect(assign()).resolves.toEqual({ id: 'lead', assignedToId: 'broker' });
    expect(tx.updateLead).not.toHaveBeenCalled();
    expect(tx.createAuditLog).not.toHaveBeenCalled();
  });
});
