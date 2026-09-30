type Translate = (de: string, en: string) => string;

const maps = {
  stage: {
    NEW: ["Neu", "New"],
    CONTACTED: ["Kontaktiert", "Contacted"],
    QUALIFIED: ["Qualifiziert", "Qualified"],
    CONSULTATION_BOOKED: ["Beratung geplant", "Consultation booked"],
    WON: ["Abgeschlossen", "Won"],
    LOST: ["Nicht weiterverfolgt", "Lost"],
  },
  type: {
    APARTMENT: ["Wohnung", "Apartment"],
    HOUSE: ["Haus", "House"],
    LAND: ["Grundstück", "Land"],
  },
  condition: {
    NEW: ["Neu / kürzlich renoviert", "New / recently renovated"],
    GOOD: ["Gut", "Good"],
    NEEDS_RENOVATION: ["Renovierungsbedürftig", "Needs renovation"],
  },
  timeline: {
    EXPLORING: ["Orientiert sich", "Exploring"],
    ASAP: ["So bald wie möglich", "As soon as possible"],
    THREE_MONTHS: ["In den nächsten 3 Monaten", "Within 3 months"],
    SIX_MONTHS: ["In den nächsten 6 Monaten", "Within 6 months"],
  },
  band: {
    HOT: ["Hohe Priorität", "High priority"],
    WARM: ["Mittlere Priorität", "Medium priority"],
    COLD: ["Niedrige Priorität", "Low priority"],
    UNSCORED: ["Noch ohne Priorität", "Not scored"],
  },
  booking: {
    CONFIRMED: ["Bestätigt", "Confirmed"],
    CALENDAR_REVIEW_REQUIRED: ["Kalender prüfen", "Calendar review"],
    PENDING_CALENDAR: ["Wartet auf Bestätigung", "Pending confirmation"],
    CANCEL_RECONCILIATION: ["Absage, Kalender prüfen", "Cancel, check calendar"],
    CANCELLED: ["Abgesagt", "Cancelled"],
    PENDING: ["Wartet auf Bestätigung", "Pending confirmation"],
    REQUESTED: ["Angefragt", "Requested"],
  },
} as const;

export function humanLabel(
  t: Translate,
  kind: keyof typeof maps,
  value: string | null | undefined,
) {
  const entry = maps[kind][value as keyof (typeof maps)[typeof kind]] as
    | readonly [string, string]
    | undefined;
  if (!entry) return (value || "—").replaceAll("_", " ");
  return t(entry[0], entry[1]);
}

export const pipelineStages = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONSULTATION_BOOKED",
  "WON",
  "LOST",
] as const;
