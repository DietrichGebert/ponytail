import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApplicationRepository } from './application.repository';
import { AdminGuard, AuthGuard, AuthRequest, OptionalStaffGuard } from './auth';
import { PropertiesService } from './properties/properties.service';
import { CursorQuery, cursorPage, cursorWhere } from './cursor';

@Injectable()
export class RecordsService {
  constructor(private repository: ApplicationRepository) {}
  async users(query: CursorQuery) {
    const rows = await this.repository.findManyUser({
      where: cursorWhere(query),
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
    return cursorPage(rows, query.limit);
  }
  async audit(query: CursorQuery) {
    const rows = await this.repository.findManyAuditLog({
      where: cursorWhere(query, 'timestamp'),
      take: query.limit + 1,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, 'timestamp');
  }
  async consents(
    subjectId: string,
    query: CursorQuery,
    actor: AuthRequest['user'],
  ) {
    const pagination = cursorWhere(query, 'occurredAt');
    if (actor.role !== 'ADMIN') {
      const lead = await this.repository.findUniqueLead({
        where: { propertyId: subjectId },
      });
      if (lead?.assignedToId !== actor.id)
        throw new ForbiddenException(
          'Consent history is restricted to your assigned seller.',
        );
    }
    const rows = await this.repository.findManyConsent({
      where: { userId: subjectId, ...pagination },
      take: query.limit + 1,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        userId: true,
        consentType: true,
        action: true,
        source: true,
        occurredAt: true,
      },
    });
    await this.repository.createAuditLog({
      data: {
        actorId: actor.id,
        action: 'CONSENT_HISTORY_VIEWED',
        entityType: 'CONSENT',
        entityId: subjectId,
      },
    });
    return cursorPage(rows, query.limit, 'occurredAt');
  }
}
@Controller('v1')
@UseGuards(AuthGuard)
export class RecordsController {
  constructor(private service: RecordsService) {}
  @Get('admin/users')
  @UseGuards(AdminGuard)
  users(@Query() query: CursorQuery) {
    return this.service.users(query);
  }
  @Get('admin/audit-logs')
  @UseGuards(AdminGuard)
  audit(@Query() query: CursorQuery) {
    return this.service.audit(query);
  }
  @Get('consents/:id')
  consents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorQuery,
    @Req() req: AuthRequest,
  ) {
    return this.service.consents(id, query, req.user);
  }
}
@Controller('v1/properties')
export class PropertyRecordsController {
  constructor(
    private repository: ApplicationRepository,
    private properties: PropertiesService,
  ) {}
  @Get(':id')
  @UseGuards(OptionalStaffGuard)
  async property(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
    @Req() req: AuthRequest,
  ) {
    const p = await this.properties.authorize(id, token, req.user);
    return {
      id: p.id,
      address: p.address,
      propertyType: p.propertyType,
      sizeSqm: p.sizeSqm,
      condition: p.condition,
      yearBuilt: p.yearBuilt,
      rooms: p.rooms,
      features: p.features,
      sellingTimeline: p.sellingTimeline,
      sellerContact: p.sellerContact,
      locale: p.locale,
      state: p.state,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
  @Get(':id/valuation')
  @UseGuards(OptionalStaffGuard)
  async valuation(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-assessment-token') token: string,
    @Req() req: AuthRequest,
  ) {
    await this.properties.authorize(id, token, req.user);
    const value = await this.repository.findFirstValuation({
      where: { propertyId: id, provider: { not: 'LEGACY_UNVERIFIED' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        provider: true,
        estimatedValue: true,
        lowRange: true,
        highRange: true,
        currency: true,
        isStale: true,
        createdAt: true,
      },
    });
    if (!value)
      throw new NotFoundException('Your valuation is being prepared.');
    return value;
  }
  @Get()
  @UseGuards(AuthGuard)
  async list(@Query() query: CursorQuery, @Req() req: AuthRequest) {
    const rows = await this.repository.findManyProperty({
      where: {
        ...cursorWhere(query),
        ...(req.user.role === 'ADMIN'
          ? {}
          : { lead: { assignedToId: req.user.id } }),
      },
      select: {
        id: true,
        address: true,
        propertyType: true,
        sizeSqm: true,
        state: true,
        locale: true,
        createdAt: true,
      },
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit);
  }
}
