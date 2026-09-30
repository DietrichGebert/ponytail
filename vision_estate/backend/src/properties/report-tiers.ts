/** An allowlist is intentional: legacy rows may contain full-report fields. */
export function valueSignalPayload(payload: Record<string, unknown>) {
  const fields = [
    'valueRange',
    'estimatedValue',
    'provider',
    'asOf',
    'confidence',
    'explanationSource',
    'keyDrivers',
    'marketContext',
    'openPoints',
    'locale',
  ];
  return {
    ...Object.fromEntries(
      fields
        .filter((k) => payload[k] !== undefined)
        .map((k) => [k, payload[k]]),
    ),
    tier: 'VALUE_SIGNAL',
  };
}
export type FullStrategy = {
  buyerPositioning: string;
  salesRoute: string;
  strategy: string[];
};
export function validateFullStrategy(value: unknown): FullStrategy {
  const v = value as FullStrategy;
  if (
    !v ||
    ![v.buyerPositioning, v.salesRoute].every(
      (s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 5000,
    ) ||
    !Array.isArray(v.strategy) ||
    !v.strategy.length ||
    v.strategy.length > 12 ||
    !v.strategy.every(
      (s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 2000,
    )
  )
    throw new Error('Invalid full report strategy');
  return {
    buyerPositioning: v.buyerPositioning,
    salesRoute: v.salesRoute,
    strategy: v.strategy,
  };
}
