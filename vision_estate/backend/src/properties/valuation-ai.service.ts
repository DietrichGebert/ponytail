import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ApplicationRepository } from '../application.repository';
import { scoreLead } from './scoring';
import {
  valueSignalPayload,
  validateFullStrategy,
  type FullStrategy,
} from './report-tiers';
type ProviderResult = {
  provider: string;
  estimatedValue: number;
  lowRange: number;
  highRange: number;
  currency: string;
  confidence: string;
  asOf: string;
  fullReport?: FullStrategy;
  explanation?: {
    strengths: string[];
    weaknesses: string[];
    marketSummary: string;
    recommendation: string;
    nextSteps: string[];
  };
};
export function validateValuation(data: ProviderResult) {
  if (
    !data ||
    !['PriceHubble', 'Sprengnetter'].includes(data.provider) ||
    data.currency !== 'EUR' ||
    ![data.estimatedValue, data.lowRange, data.highRange].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
    ) ||
    data.lowRange > data.estimatedValue ||
    data.highRange < data.estimatedValue ||
    !['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(data.confidence) ||
    !Number.isFinite(Date.parse(data.asOf))
  )
    throw new Error('Invalid licensed provider response');
  if (data.explanation) {
    const e = data.explanation;
    if (
      ![e.strengths, e.weaknesses, e.nextSteps].every(
        (a) =>
          Array.isArray(a) &&
          a.length > 0 &&
          a.length <= 12 &&
          a.every(
            (s) => typeof s === 'string' && s.length > 0 && s.length <= 2000,
          ),
      ) ||
      ![e.marketSummary, e.recommendation].every(
        (s) => typeof s === 'string' && s.length > 0 && s.length <= 5000,
      )
    )
      throw new Error('Invalid explanation response');
  }
  return data;
}
@Injectable()
export class ValuationAiService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(ValuationAiService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(private repository: ApplicationRepository) {}
  onModuleInit() {
    if (process.env.WORKERS_ENABLED !== 'true') return;
    this.timer = setInterval(() => void this.tick(), 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const jobs = await this.repository.findManyProperty({
        where: {
          OR: [
            { state: 'SUBMITTED' },
            {
              state: 'VALUATION_PENDING',
              processingError: null,
              updatedAt: { lt: new Date(Date.now() - 120000) },
            },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'asc' },
      });
      for (const job of jobs) await this.processValuationAndReports(job.id);
    } catch {
      this.logger.error(
        'Valuation worker could not access queued submissions.',
      );
    } finally {
      this.busy = false;
    }
  }
  async processValuationAndReports(propertyId: string) {
    const claim = await this.repository.updateManyProperty({
      where: {
        id: propertyId,
        OR: [
          { state: 'SUBMITTED' },
          {
            state: 'VALUATION_PENDING',
            processingError: null,
            updatedAt: { lt: new Date(Date.now() - 120000) },
          },
        ],
      },
      data: { state: 'VALUATION_PENDING', processingError: null },
    });
    if (!claim.count) return;
    try {
      const endpoint = process.env.VALUATION_GATEWAY_URL;
      if (!endpoint || !process.env.VALUATION_GATEWAY_KEY)
        throw new Error('PROVIDER_NOT_CONFIGURED');
      if (new URL(endpoint).protocol !== 'https:')
        throw new Error('PROVIDER_NOT_CONFIGURED');
      const property = await this.repository.findUniqueOrThrowProperty({
        where: { id: propertyId },
      });
      // This is an explicitly configured integration gateway, not an assumed vendor API.
      // Seller contact information is deliberately excluded.
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + process.env.VALUATION_GATEWAY_KEY,
          'Idempotency-Key': propertyId,
        },
        body: JSON.stringify({
          propertyId,
          address: property.address,
          propertyType: property.propertyType,
          sizeSqm: property.sizeSqm,
          yearBuilt: property.yearBuilt,
          condition: property.condition,
          rooms: property.rooms,
          features: property.features,
          locale: property.locale,
        }),
      });
      if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
      const raw = await response.json();
      const value = validateValuation(raw);
      const explanation = value.explanation;
      const german = property.locale === 'de-DE';
      let strategy: FullStrategy | undefined;
      try {
        if (value.fullReport) strategy = validateFullStrategy(value.fullReport);
      } catch {
        /* Retain the valid Value Signal; retry full strategy independently. */
      }
      const payload = {
        valueRange: {
          low: value.lowRange,
          high: value.highRange,
          currency: value.currency,
        },
        estimatedValue: value.estimatedValue,
        provider: value.provider,
        asOf: value.asOf,
        confidence: value.confidence,
        locale: property.locale,
        explanationSource: explanation
          ? 'INTEGRATION_GATEWAY'
          : 'FACTUAL_FALLBACK',
        keyDrivers: {
          opportunities: explanation?.strengths || [
            german
              ? 'Professionelle Anbieterbewertung liegt vor.'
              : 'Professional provider valuation received.',
          ],
          risks: explanation?.weaknesses || [
            german
              ? 'Zustand und Objektunterlagen müssen vom Makler geprüft werden.'
              : 'Condition and property documentation require broker verification.',
          ],
        },
        marketContext:
          explanation?.marketSummary ||
          (german
            ? 'Eine aktuelle Markteinordnung liegt noch nicht vor. Ihr Makler kann die lokalen Daten erläutern.'
            : 'A current market narrative is not available. Your broker can explain the local evidence.'),
        recommendation:
          explanation?.recommendation ||
          (german
            ? 'Besprechen Sie die Wertspanne mit Ihrem Makler, bevor Sie einen Angebotspreis festlegen.'
            : 'Discuss the provider range with your broker before selecting an asking price.'),
        openPoints: explanation?.nextSteps || [
          german
            ? 'Immobilienangaben überprüfen.'
            : 'Verify the property details.',
          german
            ? 'Beratung mit Ihrem Makler vereinbaren.'
            : 'Book a consultation with your broker.',
        ],
      };
      await this.repository.transaction(async (tx) => {
        const valuation = await tx.createValuation({
          data: {
            propertyId,
            provider: value.provider,
            rawResponse: raw,
            estimatedValue: value.estimatedValue,
            lowRange: value.lowRange,
            highRange: value.highRange,
            currency: value.currency,
          },
        });
        await tx.createReport({
          data: {
            propertyId,
            tier: 'VALUE_SIGNAL',
            valuationId: valuation.id,
            releaseState: 'SELLER_VISIBLE',
            payload: valueSignalPayload(payload) as any,
          },
        });
        if (strategy)
          await tx.createReport({
            data: {
              propertyId,
              tier: 'FULL',
              valuationId: valuation.id,
              releaseState: 'DRAFT_INTERNAL',
              payload: { ...payload, ...strategy, tier: 'FULL' },
            },
          });
        else
          await tx.createNotification({
            data: {
              kind: 'FULL_REPORT_GENERATION',
              recipient: '',
              payload: { propertyId },
            },
          });
        await tx.updateLead({
          where: { propertyId },
          data: scoreLead(property, value.estimatedValue),
        });
        await tx.updateProperty({
          where: { id: propertyId },
          data: { state: 'REPORT_READY', processingError: null },
        });
        await tx.createAuditLog({
          data: {
            actorId: 'valuation-worker',
            action: 'REPORT_GENERATED',
            entityType: 'PROPERTY',
            entityId: propertyId,
          },
        });
        await tx.createNotification({
          data: {
            kind: 'VALUE_SIGNAL_READY',
            recipient: (property.sellerContact as { email: string }).email,
            payload: { propertyId, locale: property.locale },
          },
        });
      });
    } catch (error) {
      const code =
        error instanceof Error && error.message === 'PROVIDER_NOT_CONFIGURED'
          ? 'PROVIDER_NOT_CONFIGURED'
          : 'PROVIDER_UNAVAILABLE';
      await this.repository.updateProperty({
        where: { id: propertyId },
        data: { state: 'VALUATION_PENDING', processingError: code },
      });
      this.logger.warn(
        JSON.stringify({ event: 'valuation_pending', propertyId, code }),
      );
    }
  }
}
