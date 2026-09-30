export function scoreLead(
  input: {
    rooms?: number | null;
    features?: string[];
    sellingTimeline?: string;
  },
  estimatedValue?: number,
) {
  const reasons = [
    { label: 'Validated property and contact details', points: 30 },
  ];
  if (input.rooms) reasons.push({ label: 'Room count supplied', points: 5 });
  if (input.features?.length)
    reasons.push({ label: 'Property features supplied', points: 5 });
  const intent =
    { ASAP: 35, THREE_MONTHS: 25, SIX_MONTHS: 15, EXPLORING: 0 }[
      input.sellingTimeline || 'EXPLORING'
    ] || 0;
  if (intent)
    reasons.push({ label: 'Declared selling timeline', points: intent });
  if (estimatedValue !== undefined)
    reasons.push({
      label: 'Licensed provider value band',
      points: estimatedValue >= 750000 ? 25 : estimatedValue >= 350000 ? 15 : 5,
    });
  const score = reasons.reduce((sum, rule) => sum + rule.points, 0);
  return {
    score,
    scoreBand:
      score >= 70
        ? ('HOT' as const)
        : score >= 45
          ? ('WARM' as const)
          : ('COLD' as const),
    scoreVersion: 'v1',
    scoreReasons: reasons,
  };
}
