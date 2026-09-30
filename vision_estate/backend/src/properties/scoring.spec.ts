import { describe, it, expect } from 'vitest';
import { scoreLead } from './scoring';
import { validateValuation } from './valuation-ai.service';
describe('Deterministic scoring', () => {
  it('does not classify an exploring seller as hot', () =>
    expect(scoreLead({ sellingTimeline: 'EXPLORING' })).toMatchObject({
      score: 30,
      scoreBand: 'COLD',
    }));
  it('records the reason for every point', () => {
    const r = scoreLead(
      { sellingTimeline: 'ASAP', rooms: 4, features: ['GARDEN'] },
      800000,
    );
    expect(r.score).toBe(100);
    expect(r.scoreReasons.reduce((s, r) => s + r.points, 0)).toBe(r.score);
    expect(r.scoreVersion).toBe('v1');
  });
  it('does not fabricate a value band when no provider result exists', () =>
    expect(scoreLead({ sellingTimeline: 'ASAP' }).score).toBe(65));
});
describe('Provider output validation', () => {
  const valid = {
    provider: 'PriceHubble',
    estimatedValue: 500000,
    lowRange: 450000,
    highRange: 550000,
    currency: 'EUR',
    confidence: 'HIGH',
    asOf: '2026-09-11',
  };
  it('preserves the licensed value', () =>
    expect(validateValuation(valid).estimatedValue).toBe(500000));
  it('rejects invented providers and contradictory ranges', () => {
    expect(() =>
      validateValuation({ ...valid, provider: 'Local estimate' }),
    ).toThrow();
    expect(() => validateValuation({ ...valid, lowRange: 600000 })).toThrow();
  });
  it('rejects malformed explanations', () =>
    expect(() =>
      validateValuation({
        ...valid,
        explanation: {
          strengths: [],
          weaknesses: [],
          nextSteps: [],
          marketSummary: '',
          recommendation: '',
        },
      }),
    ).toThrow());
});
