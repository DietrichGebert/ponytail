import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValuationAiService } from './properties/valuation-ai.service';
import { FullReportWorker } from './full-report-worker';
const value = {
  provider: 'PriceHubble',
  estimatedValue: 500000,
  lowRange: 450000,
  highRange: 550000,
  currency: 'EUR',
  confidence: 'HIGH',
  asOf: '2026-09-01',
};
const full = {
  buyerPositioning: 'Provider-supported positioning',
  salesRoute: 'Broker-reviewed route',
  strategy: ['Review supporting evidence'],
};
function repository() {
  const r: any = {
    updateManyProperty: vi.fn().mockResolvedValue({ count: 1 }),
    findUniqueOrThrowProperty: vi
      .fn()
      .mockResolvedValue({
        id: 'p',
        locale: 'de-DE',
        sellerContact: { email: 'synthetic@example.invalid' },
      }),
    createValuation: vi.fn().mockResolvedValue({ id: 'valuation' }),
    createReport: vi.fn(),
    updateLead: vi.fn(),
    updateProperty: vi.fn(),
    createAuditLog: vi.fn(),
    createNotification: vi.fn(),
  };
  r.transaction = async (fn: any) => fn(r);
  return r;
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('Two-tier generation', () => {
  it('persists a compact Value Signal and distinct internal full strategy together', async () => {
    vi.stubEnv('VALUATION_GATEWAY_URL', 'https://example.invalid');
    vi.stubEnv('VALUATION_GATEWAY_KEY', 'test-only');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ ...value, fullReport: full }),
        }),
    );
    const r = repository();
    await new ValuationAiService(r).processValuationAndReports('p');
    expect(r.createReport).toHaveBeenCalledTimes(2);
    const compact = r.createReport.mock.calls[0][0].data,
      internal = r.createReport.mock.calls[1][0].data;
    expect(compact.payload.recommendation).toBeUndefined();
    expect(compact.payload.strategy).toBeUndefined();
    expect(compact.releaseState).toBe('SELLER_VISIBLE');
    expect(internal.releaseState).toBe('DRAFT_INTERNAL');
    expect(internal.payload.strategy).toEqual(full.strategy);
    expect(internal.payload.valueRange).toEqual(compact.payload.valueRange);
  });
  it('keeps Value Signal ready and queues missing full strategy without inventing it', async () => {
    vi.stubEnv('VALUATION_GATEWAY_URL', 'https://example.invalid');
    vi.stubEnv('VALUATION_GATEWAY_KEY', 'test-only');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => value }),
    );
    const r = repository();
    await new ValuationAiService(r).processValuationAndReports('p');
    expect(r.createReport).toHaveBeenCalledTimes(1);
    expect(r.createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: 'FULL_REPORT_GENERATION' }),
    });
    expect(r.updateProperty).toHaveBeenCalledWith({
      where: { id: 'p' },
      data: { state: 'REPORT_READY', processingError: null },
    });
  });
  it('does not send seller contact details to the valuation gateway', async () => {
    vi.stubEnv('VALUATION_GATEWAY_URL', 'https://example.invalid');
    vi.stubEnv('VALUATION_GATEWAY_KEY', 'test-only');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => value });
    vi.stubGlobal('fetch', fetchMock);
    await new ValuationAiService(repository()).processValuationAndReports('p');
    expect(fetchMock.mock.calls[0][1].body).not.toContain(
      'synthetic@example.invalid',
    );
  });
  it('leaves full-tier jobs untouched when no strategy gateway is configured', async () => {
    vi.stubEnv('AI_REPORT_GATEWAY_URL', '');
    const r = repository();
    r.findManyNotification = vi.fn();
    await new FullReportWorker(r).tick();
    expect(r.findManyNotification).not.toHaveBeenCalled();
  });
});
