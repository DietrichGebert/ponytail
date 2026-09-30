import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LeadQueryDto } from './dto/lead-query.dto';

@Injectable()
export class LeadQueryRepository {
  constructor(private prisma: PrismaService) {}

  async list(
    actorId: string,
    assignedToId: string | null,
    query: LeadQueryDto,
  ) {
    // All user input remains a bound parameter, including literal search punctuation.
    const filters = [Prisma.sql`TRUE`];
    if (assignedToId !== null)
      filters.push(Prisma.sql`l."assignedToId" = ${assignedToId}`);
    if (query.stage) filters.push(Prisma.sql`l."stage" = ${query.stage}`);
    if (query.q)
      filters.push(
        Prisma.sql`strpos(lower(concat_ws(' ', p."sellerContact"->>'name', p."address"->>'street', p."address"->>'city', p."address"->>'postalCode')), lower(${query.q})) > 0`,
      );
    const where = Prisma.join(filters, ' AND ');
    return this.prisma.$transaction(
      async (tx) => {
        const counts = await tx.$queryRaw<{ total: number }[]>(
          Prisma.sql`SELECT count(*)::int AS total FROM "Lead" l JOIN "Property" p ON p.id = l."propertyId" WHERE ${where}`,
        );
        const total = counts[0].total;
        const page = Math.min(query.page, Math.max(1, Math.ceil(total / 50)));
        const rows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT l.id FROM "Lead" l JOIN "Property" p ON p.id = l."propertyId" WHERE ${where} ORDER BY l."createdAt" DESC, l.id DESC LIMIT 50 OFFSET ${(page - 1) * 50}`,
        );
        const items = await tx.lead.findMany({
          where: { id: { in: rows.map((row) => row.id) } },
          include: {
            property: {
              select: {
                id: true,
                address: true,
                sellerContact: true,
                propertyType: true,
                sizeSqm: true,
                condition: true,
                yearBuilt: true,
                rooms: true,
                features: true,
                sellingTimeline: true,
                state: true,
                processingError: true,
                reports: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'LEADS_VIEWED',
            entityType: 'LEAD',
            entityId: 'list',
            // Search text may contain PII; do not copy it into audit metadata.
            metadata: {
              page,
              stage: query.stage || 'ALL',
              searched: !!query.q,
            },
          },
        });
        return { items, total, page, pageSize: 50 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
