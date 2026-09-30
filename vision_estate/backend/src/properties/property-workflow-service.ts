import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationRepository } from '../application.repository';
import { AuthRequest } from '../auth';
import { CreatePropertyDto } from './dto/create-property.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { LeadUpdateDto } from './dto/lead-update.dto';
import { LeadQueryService } from './lead-query.service';
import { PropertiesService } from './properties.service';
import { valueSignalPayload } from './report-tiers';
@Injectable()
export class PropertyWorkflowService {
  constructor(
    private service: PropertiesService,
    private repository: ApplicationRepository,
    private leadQueries: LeadQueryService,
  ) {}
  create(dto: CreatePropertyDto, key: string, token: string, clientIp: string) {
    return this.service.create(dto, clientIp, key, token);
  }
  async status(id: string, token: string) {
    const p = await this.service.authorize(id, token);
    const lead = await this.repository.findUniqueLead({
      where: { propertyId: id },
      select: { reviewedAt: true },
    });
    return {
      id: p.id,
      state: p.state,
      processingError: p.processingError,
      address: p.address,
      locale: p.locale,
      propertyType: p.propertyType,
      sizeSqm: p.sizeSqm,
      createdAt: p.createdAt,
      reviewedAt: lead?.reviewedAt || null,
    };
  }
  async signal(id: string, token: string, actor?: AuthRequest['user']) {
    await this.service.authorize(id, token, actor);
    const report = await this.repository.findFirstReport({
      where: {
        propertyId: id,
        tier: 'VALUE_SIGNAL',
        releaseState: 'SELLER_VISIBLE',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!report)
      throw new NotFoundException('Your valuation is being prepared.');
    const full = await this.repository.findFirstReport({
      where: { propertyId: id, tier: 'FULL', releaseState: 'RELEASED' },
    });
    return {
      reportId: report.id,
      ...valueSignalPayload(report.payload as Record<string, unknown>),
      fullReport: { available: !!full },
    };
  }
  async full(id: string, token: string, actor?: AuthRequest['user']) {
    await this.service.authorize(id, token, actor);
    const report = await this.repository.findFirstReport({
      where: { propertyId: id, tier: 'FULL', releaseState: 'RELEASED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!report)
      throw new ForbiddenException(
        'Your broker has not released this report yet.',
      );
    return { ...(report.payload as object), tier: 'FULL', reportId: report.id };
  }
  leads(user: AuthRequest['user'], query: LeadQueryDto) {
    return this.leadQueries.list(user, query);
  }
  private async ownedLead(
    id: string,
    user: AuthRequest['user'],
    repository = this.repository,
  ) {
    const lead = await repository.findUniqueLead({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found.');
    if (user.role !== 'ADMIN' && lead.assignedToId !== user.id)
      throw new ForbiddenException('This lead is assigned to another broker.');
    return lead;
  }
  async update(id: string, dto: LeadUpdateDto, user: AuthRequest['user']) {
    await this.ownedLead(id, user);
    return this.repository.transaction(async (tx) => {
      await tx.lockLead(id);
      await this.ownedLead(id, user, tx);
      const lead = await tx.updateLead({ where: { id }, data: dto });
      await tx.createAuditLog({
        data: {
          actorId: user.id,
          action: 'LEAD_UPDATED',
          entityType: 'LEAD',
          entityId: id,
          metadata: { stage: dto.stage || lead.stage },
        },
      });
      return lead;
    });
  }
  async review(id: string, user: AuthRequest['user']) {
    await this.ownedLead(id, user);
    return this.repository.transaction(async (tx) => {
      await tx.lockLead(id);
      await this.ownedLead(id, user, tx);
      const reviewedAt = new Date();
      const lead = await tx.updateLead({
        where: { id },
        data: {
          reviewedByUserId: user.id,
          reviewedAt,
          stage: 'CONTACTED',
        },
      });
      // Bind the case review to each currently generated, unreleased full report.
      // A report generated later requires a fresh review; existing evidence is immutable.
      const reports = await tx.updateManyReport({
        where: {
          propertyId: lead.propertyId,
          tier: 'FULL',
          reviewedAt: null,
          releaseState: { not: 'RELEASED' },
        },
        data: {
          reviewedAt,
          reviewedByUserId: user.id,
          releaseState: 'UNDER_BROKER_REVIEW',
        },
      });
      await tx.createAuditLog({
        data: {
          actorId: user.id,
          action: 'LEAD_REVIEWED',
          entityType: 'LEAD',
          entityId: id,
          metadata: { reviewedReports: reports.count },
        },
      });
      return lead;
    });
  }
  async release(id: string, user: AuthRequest['user']) {
    const report = await this.repository.findUniqueReport({
      where: { id },
      include: { property: { include: { lead: true } } },
    });
    if (
      !report ||
      report.tier !== 'FULL' ||
      report.property.state !== 'REPORT_READY' ||
      !report.property.lead
    )
      throw new NotFoundException('Full report not found.');
    const lead = await this.ownedLead(report.property.lead.id, user);
    if (!lead.reviewedAt)
      throw new ConflictException(
        'Record your broker review before releasing the full report.',
      );
    return this.repository.transaction(async (tx) => {
      await tx.lockLead(lead.id);
      const currentLead = await this.ownedLead(lead.id, user, tx);
      const current = await tx.findUniqueReport({ where: { id } });
      if (current?.releaseState === 'RELEASED')
        return { reportId: id, releaseState: 'RELEASED' };
      if (
        !current?.reviewedAt ||
        !current.reviewedByUserId ||
        !currentLead.reviewedAt ||
        !currentLead.reviewedByUserId
      )
        throw new ConflictException(
          'Record your broker review of this report before releasing it.',
        );
      const changed = await tx.updateManyReport({
        where: { id, releaseState: { not: 'RELEASED' } },
        data: {
          releaseState: 'RELEASED',
          releasedByUserId: user.id,
          releasedAt: new Date(),
        },
      });
      if (changed.count) {
        await tx.createAuditLog({
          data: {
            actorId: user.id,
            action: 'FULL_REPORT_RELEASED',
            entityType: 'REPORT',
            entityId: id,
          },
        });
        const contact = report.property.sellerContact as { email: string };
        await tx.createNotification({
          data: {
            kind: 'FULL_REPORT_RELEASED',
            recipient: contact.email,
            payload: {
              propertyId: report.propertyId,
              reportId: id,
              locale: report.property.locale,
            },
          },
        });
      }
      return { reportId: id, releaseState: 'RELEASED' };
    });
  }
  async retry(id: string, user: AuthRequest['user']) {
    const lead = await this.ownedLead(id, user);
    const property = await this.repository.findUniqueProperty({
      where: { id: lead.propertyId },
    });
    if (property?.state === 'REPORT_READY') {
      const jobs = await this.repository.findManyNotification({
        where: {
          kind: 'FULL_REPORT_GENERATION',
          state: 'FAILED',
          payload: { path: ['propertyId'], equals: lead.propertyId },
        },
        take: 1,
      });
      if (!jobs[0]) return { queued: false };
      return this.repository.transaction(async (tx) => {
        await tx.lockLead(id);
        await this.ownedLead(id, user, tx);
        const changed = await tx.updateManyNotification({
          where: { id: jobs[0].id, state: 'FAILED' },
          data: { state: 'PENDING', attempts: 0, lastError: null },
        });
        if (!changed.count) return { queued: false };
        await tx.createAuditLog({
          data: {
            actorId: user.id,
            action: 'FULL_REPORT_RETRY_REQUESTED',
            entityType: 'PROPERTY',
            entityId: lead.propertyId,
          },
        });
        return { queued: true };
      });
    }
    return this.repository.transaction(async (tx) => {
      await tx.lockLead(id);
      await this.ownedLead(id, user, tx);
      const changed = await tx.updateManyProperty({
        where: {
          id: lead.propertyId,
          state: 'VALUATION_PENDING',
          processingError: { not: null },
        },
        data: { state: 'SUBMITTED', processingError: null },
      });
      if (changed.count)
        await tx.createAuditLog({
          data: {
            actorId: user.id,
            action: 'VALUATION_RETRY_REQUESTED',
            entityType: 'PROPERTY',
            entityId: lead.propertyId,
          },
        });
      return { queued: changed.count > 0 };
    });
  }
}
