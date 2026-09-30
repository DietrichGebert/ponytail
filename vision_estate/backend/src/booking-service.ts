import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApplicationRepository } from './application.repository';
import { integrationConfigured } from './integration-config';
import { AuthRequest } from './auth';
import { BookingDto, SlotDto } from './operations.dto';
import { PropertiesService } from './properties/properties.service';
@Injectable()
export class BookingService {
  constructor(
    private repository: ApplicationRepository,
    private properties: PropertiesService,
  ) {}
  list(user: AuthRequest['user']) {
    return this.repository.findManyBooking({
      where: user.role === 'ADMIN' ? {} : { slot: { brokerId: user.id } },
      include: {
        slot: { include: { broker: { select: { name: true } } } },
        property: { select: { address: true, sellerContact: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async slot(dto: SlotDto, user: AuthRequest['user']) {
    const start = new Date(dto.startsAt),
      end = new Date(dto.endsAt);
    if (
      start <= new Date() ||
      end <= start ||
      end.getTime() - start.getTime() > 2 * 3600000
    )
      throw new BadRequestException(
        'Choose a future slot of no more than two hours.',
      );
    try {
      return await this.repository.transaction(
        async (tx) => {
          const overlap = await tx.findFirstAvailabilitySlot({
            where: {
              brokerId: user.id,
              startsAt: { lt: end },
              endsAt: { gt: start },
            },
          });
          if (overlap)
            throw new ConflictException(
              'This slot overlaps existing availability.',
            );
          const slot = await tx.createAvailabilitySlot({
            data: { brokerId: user.id, startsAt: start, endsAt: end },
          });
          await tx.createAuditLog({
            data: {
              actorId: user.id,
              action: 'AVAILABILITY_CREATED',
              entityType: 'SLOT',
              entityId: slot.id,
            },
          });
          return slot;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(e.code)
      )
        throw new ConflictException(
          'Availability changed. Refresh and try again.',
        );
      throw e;
    }
  }
  async slots(id: string, token: string) {
    await this.properties.authorize(id, token);
    if (
      !integrationConfigured(
        process.env.CALENDAR_GATEWAY_URL,
        process.env.CALENDAR_GATEWAY_KEY,
      )
    )
      throw new ServiceUnavailableException(
        'Online booking is not available yet. Please check back later.',
      );
    const lead = await this.repository.findUniqueLead({
      where: { propertyId: id },
    });
    if (!lead?.assignedToId) return { items: [] };
    return {
      items: await this.repository.findManyAvailabilitySlot({
        where: {
          brokerId: lead.assignedToId,
          broker: { active: true },
          startsAt: { gt: new Date() },
          OR: [
            { booking: null },
            { booking: { status: 'CANCELLED' } },
          ],
        },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          broker: { select: { name: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 30,
      }),
    };
  }
  async book(id: string, dto: BookingDto, token: string) {
    await this.properties.authorize(id, token);
    if (
      !integrationConfigured(
        process.env.CALENDAR_GATEWAY_URL,
        process.env.CALENDAR_GATEWAY_KEY,
      )
    )
      throw new ServiceUnavailableException(
        'Online booking is not available yet.',
      );
    try {
      return await this.repository.transaction(
        async (tx) => {
          const lead = await tx.findUniqueLead({ where: { propertyId: id } });
          const slot = await tx.findUniqueAvailabilitySlot({
            where: { id: dto.slotId },
            include: { booking: true, broker: true },
          });
          if (
            !slot ||
            !slot.broker.active ||
            slot.brokerId !== lead?.assignedToId ||
            slot.startsAt <= new Date()
          )
            throw new BadRequestException(
              'This consultation time is not available.',
            );
          if (slot.booking) {
            if (slot.booking.propertyId === id) return slot.booking;
            throw new ConflictException(
              'That time was just reserved. Please choose another.',
            );
          }
          const previous = await tx.findFirstBooking({
            where: {
              propertyId: id,
              status: {
                in: [
                  'PENDING_CALENDAR',
                  'CONFIRMED',
                  'CALENDAR_REVIEW_REQUIRED',
                  'CANCEL_RECONCILIATION',
                ],
              },
            },
          });
          if (previous)
            throw new ConflictException(
              'You already have an active consultation request.',
            );
          const booking = await tx.createBooking({
            data: { propertyId: id, slotId: dto.slotId },
          });
          await tx.createAuditLog({
            data: {
              actorId: id,
              action: 'BOOKING_REQUESTED',
              entityType: 'BOOKING',
              entityId: booking.id,
            },
          });
          return booking;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(e.code)
      )
        throw new ConflictException(
          'Availability changed. Refresh and try again.',
        );
      throw e;
    }
  }
  async sellerBookings(id: string, token: string) {
    await this.properties.authorize(id, token);
    return this.repository.findManyBooking({
      where: { propertyId: id },
      select: {
        id: true,
        status: true,
        slot: {
          select: {
            startsAt: true,
            endsAt: true,
            broker: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
  async cancel(id: string, token: string) {
    await this.properties.authorize(id, token);
    return this.repository.transaction(async (tx) => {
      const active = await tx.findFirstBooking({
        where: {
          propertyId: id,
          status: {
            in: [
              'PENDING_CALENDAR',
              'CONFIRMED',
              'CALENDAR_REVIEW_REQUIRED',
              'CANCEL_RECONCILIATION',
            ],
          },
        },
        include: { slot: { include: { broker: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      if (!active) {
        const done = await tx.findFirstBooking({
          where: { propertyId: id, status: 'CANCELLED' },
          orderBy: { createdAt: 'desc' },
        });
        if (!done)
          throw new NotFoundException('No consultation request to cancel.');
        return { id: done.id, status: done.status, slot: null };
      }
      if (active.status === 'CANCEL_RECONCILIATION')
        return this.sellerView(active);
      const needsCalendar =
        active.status === 'CONFIRMED' || Boolean(active.calendarEventId);
      if (needsCalendar) {
        const updated = await tx.updateBooking({
          where: { id: active.id },
          data: { status: 'CANCEL_RECONCILIATION' },
        });
        await tx.createAuditLog({
          data: {
            actorId: id,
            action: 'BOOKING_CANCEL_RECONCILIATION',
            entityType: 'BOOKING',
            entityId: active.id,
          },
        });
        return this.sellerView({ ...active, status: updated.status });
      }
      await tx.updateBooking({
        where: { id: active.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          slotStartsAt: active.slot?.startsAt,
          slotEndsAt: active.slot?.endsAt,
          slotId: null,
        },
      });
      await tx.createAuditLog({
        data: {
          actorId: id,
          action: 'BOOKING_CANCELLED',
          entityType: 'BOOKING',
          entityId: active.id,
        },
      });
      return this.sellerView({ ...active, status: 'CANCELLED', slot: null });
    });
  }
  async reconcile(bookingId: string, user: AuthRequest['user']) {
    return this.repository.transaction(async (tx) => {
      const booking = await tx.findFirstBooking({
        where: { id: bookingId },
        include: {
          slot: true,
          property: { include: { lead: true } },
        },
      });
      if (!booking) throw new NotFoundException('Booking not found.');
      const assigned = booking.property.lead?.assignedToId;
      const ownsSlot = booking.slot?.brokerId === user.id;
      if (user.role !== 'ADMIN' && assigned !== user.id && !ownsSlot)
        throw new ForbiddenException(
          'Only the assigned broker can close this cancellation.',
        );
      if (booking.status === 'CANCELLED')
        return { id: booking.id, status: booking.status };
      if (booking.status !== 'CANCEL_RECONCILIATION')
        throw new ConflictException(
          'This booking is not waiting for calendar reconciliation.',
        );
      await tx.updateBooking({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          slotStartsAt: booking.slot?.startsAt,
          slotEndsAt: booking.slot?.endsAt,
          slotId: null,
        },
      });
      await tx.createAuditLog({
        data: {
          actorId: user.id,
          action: 'BOOKING_RECONCILED',
          entityType: 'BOOKING',
          entityId: booking.id,
        },
      });
      return { id: booking.id, status: 'CANCELLED' };
    });
  }
  private sellerView(booking: {
    id: string;
    status: string;
    slot: {
      startsAt: Date;
      endsAt: Date;
      broker: { name: string };
    } | null;
  }) {
    return {
      id: booking.id,
      status: booking.status,
      slot: booking.slot
        ? {
            startsAt: booking.slot.startsAt,
            endsAt: booking.slot.endsAt,
            broker: { name: booking.slot.broker.name },
          }
        : null,
    };
  }
}
