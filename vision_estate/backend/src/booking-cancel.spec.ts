import { describe, expect, it, vi } from 'vitest';
import { BookingService } from './booking-service';

function service(tx: Record<string, ReturnType<typeof vi.fn>>) {
  const repository = {
    transaction: (work: (repo: typeof tx) => Promise<unknown>) => work(tx),
  };
  const properties = { authorize: vi.fn() };
  return new BookingService(repository as never, properties as never);
}

const slot = {
  startsAt: new Date('2026-10-02T09:00:00Z'),
  endsAt: new Date('2026-10-02T10:00:00Z'),
  brokerId: 'broker-1',
  broker: { name: 'Ada' },
};

describe('Booking cancellation', () => {
  it('releases an unconfirmed slot and records one audit', async () => {
    const booking = {
      id: 'booking-1',
      status: 'PENDING_CALENDAR',
      calendarEventId: null,
      slot,
    };
    const tx = {
      findFirstBooking: vi.fn().mockResolvedValue(booking),
      updateBooking: vi.fn().mockResolvedValue({}),
      createAuditLog: vi.fn(),
    };
    const result = await service(tx).cancel('property-1', 'token');
    expect(result).toEqual({ id: 'booking-1', status: 'CANCELLED', slot: null });
    expect(tx.updateBooking).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: expect.objectContaining({ status: 'CANCELLED', slotId: null }),
    });
    expect(tx.createAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'BOOKING_CANCELLED' }),
    });
  });

  it('does not audit again when nothing is active', async () => {
    const tx = {
      findFirstBooking: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'booking-1', status: 'CANCELLED' }),
      updateBooking: vi.fn(),
      createAuditLog: vi.fn(),
    };
    const result = await service(tx).cancel('property-1', 'token');
    expect(result.status).toBe('CANCELLED');
    expect(tx.updateBooking).not.toHaveBeenCalled();
    expect(tx.createAuditLog).not.toHaveBeenCalled();
  });

  it('holds a confirmed booking until the broker reconciles the calendar', async () => {
    const booking = {
      id: 'booking-2',
      status: 'CONFIRMED',
      calendarEventId: 'event-1',
      slot,
    };
    const tx = {
      findFirstBooking: vi.fn().mockResolvedValue(booking),
      updateBooking: vi.fn().mockResolvedValue({ status: 'CANCEL_RECONCILIATION' }),
      createAuditLog: vi.fn(),
    };
    const result = await service(tx).cancel('property-1', 'token');
    expect(result.status).toBe('CANCEL_RECONCILIATION');
    expect(result.slot?.broker.name).toBe('Ada');
    expect(tx.updateBooking.mock.calls[0][0].data).toEqual({
      status: 'CANCEL_RECONCILIATION',
    });
    expect(tx.createAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'BOOKING_CANCEL_RECONCILIATION',
      }),
    });
  });

  it('lets the assigned broker release a reconciled cancellation', async () => {
    const tx = {
      findFirstBooking: vi.fn().mockResolvedValue({
        id: 'booking-2',
        status: 'CANCEL_RECONCILIATION',
        slot,
        property: { lead: { assignedToId: 'broker-1' } },
      }),
      updateBooking: vi.fn(),
      createAuditLog: vi.fn(),
    };
    const result = await service(tx).reconcile('booking-2', {
      id: 'broker-1',
      role: 'BROKER',
    } as never);
    expect(result).toEqual({ id: 'booking-2', status: 'CANCELLED' });
    expect(tx.updateBooking).toHaveBeenCalledWith({
      where: { id: 'booking-2' },
      data: expect.objectContaining({ status: 'CANCELLED', slotId: null }),
    });
  });

  it('refuses reconciliation from an unrelated broker', async () => {
    const tx = {
      findFirstBooking: vi.fn().mockResolvedValue({
        id: 'booking-2',
        status: 'CANCEL_RECONCILIATION',
        slot,
        property: { lead: { assignedToId: 'broker-1' } },
      }),
      updateBooking: vi.fn(),
      createAuditLog: vi.fn(),
    };
    await expect(
      service(tx).reconcile('booking-2', {
        id: 'broker-2',
        role: 'BROKER',
      } as never),
    ).rejects.toThrow('assigned broker');
    expect(tx.updateBooking).not.toHaveBeenCalled();
  });
});
