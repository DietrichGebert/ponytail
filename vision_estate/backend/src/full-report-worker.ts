import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ApplicationRepository } from './application.repository';
import { validateFullStrategy } from './properties/report-tiers';
import * as fullDe from './templates/reports/full-report.de-DE.json';
import * as fullEn from './templates/reports/full-report.en.json';

/** Independent full-tier retry: never revalues a property or blocks its Value Signal. */
@Injectable()
export class FullReportWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private logger = new Logger(FullReportWorker.name);
  constructor(private repository: ApplicationRepository) {}
  onModuleInit() {
    if (process.env.WORKERS_ENABLED === 'true') {
      this.timer = setInterval(() => void this.tick(), 30000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async tick() {
    const url = process.env.AI_REPORT_GATEWAY_URL,
      key = process.env.AI_REPORT_GATEWAY_KEY;
    if (this.busy || !url || !key || !url.startsWith('https://')) return;
    this.busy = true;
    try {
      const jobs = await this.repository.findManyNotification({
        where: {
          kind: 'FULL_REPORT_GENERATION',
          state: 'PENDING',
          attempts: { lt: 5 },
        },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
      for (const job of jobs) {
        try {
          const { propertyId } = job.payload as { propertyId: string };
          const property = await this.repository.findUniqueOrThrowProperty({
            where: { id: propertyId },
            include: {
              valuations: { orderBy: { createdAt: 'desc' }, take: 1 },
              reports: {
                where: { tier: 'VALUE_SIGNAL' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });
          const prior = await this.repository.findFirstReport({
            where: { propertyId, tier: 'FULL' },
          });
          if (!prior) {
            if (!property.valuations[0] || !property.reports[0])
              throw new Error('Context unavailable');
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + key,
                'Idempotency-Key': job.id,
              },
              signal: AbortSignal.timeout(25000),
              body: JSON.stringify({
                tier: 'FULL',
                locale: property.locale,
                property: {
                  address: property.address,
                  propertyType: property.propertyType,
                  sizeSqm: property.sizeSqm,
                  yearBuilt: property.yearBuilt,
                  condition: property.condition,
                  features: property.features,
                },
                valuation: property.valuations[0].rawResponse,
                templateVersion:
                  property.locale === 'de-DE' ? fullDe.version : fullEn.version,
                instruction:
                  property.locale === 'de-DE'
                    ? fullDe.instruction
                    : fullEn.instruction,
                constraints: {
                  valuationSource: 'LICENSED_PROVIDER_ONLY',
                  outputFields: ['buyerPositioning', 'salesRoute', 'strategy'],
                },
              }),
            });
            if (!response.ok) throw new Error('Generation unavailable');
            const strategy = validateFullStrategy(await response.json());
            await this.repository.transaction(async (tx) => {
              // Lock the property row to serialize concurrent full-tier completions.
              await tx.updateManyProperty({
                where: { id: propertyId, state: 'REPORT_READY' },
                data: { state: 'REPORT_READY' },
              });
              if (
                !(await tx.findFirstReport({
                  where: { propertyId, tier: 'FULL' },
                }))
              )
                await tx.createReport({
                  data: {
                    propertyId,
                    tier: 'FULL',
                    valuationId: property.valuations[0].id,
                    releaseState: 'DRAFT_INTERNAL',
                    payload: {
                      ...(property.reports[0].payload as object),
                      ...strategy,
                      tier: 'FULL',
                    },
                  },
                });
              await tx.updateNotification({
                where: { id: job.id },
                data: {
                  state: 'COMPLETED',
                  attempts: { increment: 1 },
                  lastError: null,
                },
              });
            });
          } else
            await this.repository.updateNotification({
              where: { id: job.id },
              data: { state: 'COMPLETED' },
            });
        } catch {
          await this.repository.updateNotification({
            where: { id: job.id },
            data: {
              attempts: { increment: 1 },
              state: job.attempts >= 4 ? 'FAILED' : 'PENDING',
              lastError: 'Full report generation unavailable',
            },
          });
        }
      }
    } catch {
      this.logger.warn('Full report work could not be processed.');
    } finally {
      this.busy = false;
    }
  }
}
