import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApplicationRepository } from './application.repository';
import { integrationConfigured } from './integration-config';
import { AuthRequest, passwordHash } from './auth';
import { ActiveDto, AssignDto, UserDto } from './operations.dto';
@Injectable()
export class AdminService {
  constructor(private repository: ApplicationRepository) {}
  async overview() {
    const [users, leads, pending, notifications, audit] = await Promise.all([
      this.repository.findManyUser({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          invitation: {
            select: {
              id: true,
              expiresAt: true,
              acceptedAt: true,
              revokedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.repository.countLead(),
      this.repository.countProperty({ where: { state: 'VALUATION_PENDING' } }),
      this.repository.groupByNotification({ by: ['state'], _count: true }),
      this.repository.findManyAuditLog({
        take: 30,
        orderBy: { timestamp: 'desc' },
      }),
    ]);
    return {
      users,
      leads,
      pending,
      notifications,
      audit,
      integrations: {
        valuation: integrationConfigured(
          process.env.VALUATION_GATEWAY_URL,
          process.env.VALUATION_GATEWAY_KEY,
        ),
        calendar: integrationConfigured(
          process.env.CALENDAR_GATEWAY_URL,
          process.env.CALENDAR_GATEWAY_KEY,
        ),
        email: integrationConfigured(
          process.env.EMAIL_GATEWAY_URL,
          process.env.EMAIL_GATEWAY_KEY,
        ),
        workers: process.env.WORKERS_ENABLED === 'true',
      },
      scoring: {
        version: 'v1',
        hot: 70,
        warm: 45,
        rules:
          'Validated details: 30; rooms: 5; features: 5; timeline: 0–35; licensed value band: 5–25.',
      },
    };
  }
  async create(dto: UserDto, actor: AuthRequest['user']) {
    try {
      return await this.repository.transaction(async (tx) => {
        const user = await tx.createUser({
          data: {
            email: dto.email.toLowerCase().trim(),
            name: dto.name,
            passwordHash: passwordHash(dto.password),
            role: dto.role,
          },
          select: { id: true, name: true, email: true, role: true },
        });
        await tx.createAuditLog({
          data: {
            actorId: actor.id,
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: user.id,
          },
        });
        return user;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException(
          'An account with this email already exists.',
        );
      throw e;
    }
  }
  async active(id: string, dto: ActiveDto, actor: AuthRequest['user']) {
    if (id === actor.id)
      throw new BadRequestException('You cannot deactivate your own account.');
    return this.repository.transaction(async (tx) => {
      await tx.lockStaffUser(id);
      const invitation = await tx.findUniqueStaffInvitation({
        where: { userId: id },
      });
      if (dto.active && invitation && !invitation.acceptedAt)
        throw new BadRequestException(
          'The broker must verify their invitation before activation.',
        );
      const user = await tx.updateUser({
        where: { id },
        data: { active: dto.active },
        select: { id: true, active: true },
      });
      if (!dto.active) await tx.deleteManySession({ where: { userId: id } });
      if (!dto.active)
        await tx.updateManyStaffInvitation({
          where: { userId: id, acceptedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await tx.createAuditLog({
        data: {
          actorId: actor.id,
          action: dto.active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          entityType: 'USER',
          entityId: id,
        },
      });
      return user;
    });
  }
  async assign(id: string, dto: AssignDto, actor: AuthRequest['user']) {
    return this.repository.transaction(async (tx) => {
      await tx.lockLead(id);
      const existing = await tx.findUniqueLead({ where: { id } });
      if (!existing) throw new NotFoundException('This lead no longer exists. Refresh the pipeline.');
      await tx.lockStaffUser(dto.brokerId);
      const user = await tx.findFirstUser({
        where: { id: dto.brokerId, active: true, role: 'BROKER' },
      });
      if (!user) throw new BadRequestException('Select an active, verified broker. Refresh the broker list.');
      if (existing.assignedToId === user.id) return existing;
      const lead = await tx.updateLead({
        where: { id },
        data: { assignedToId: user.id },
      });
      await tx.createAuditLog({
        data: {
          actorId: actor.id,
          action: 'LEAD_ASSIGNED',
          entityType: 'LEAD',
          entityId: id,
          metadata: { brokerId: user.id },
        },
      });
      return lead;
    });
  }
}
