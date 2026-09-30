"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage, type AssessmentCreated } from "@/lib/api";
import { useLocale } from "./locale-provider";
import { PropertyIcon } from "./property-icon";
type Copy = {
  locale: string;
  version: string;
  processing: string;
  newsletter: string;
};

export default function SellerIntake({
  initialType = "APARTMENT",
}: {
  initialType?: string;
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [copy, setCopy] = useState<Copy | null>(null),
    [copyAttempt, setCopyAttempt] = useState(0),
    [copyError, setCopyError] = useState(false);
  const key = useRef(""),
    token = useRef(""),
    sent = useRef("");
  const [data, setData] = useState({
    street: "",
    postalCode: "",
    city: "",
    propertyType: initialType,
    sizeSqm: "",
    rooms: "",
    yearBuilt: "",
    condition: "GOOD",
    name: "",
    email: "",
    phone: "",
    sellingTimeline: "EXPLORING",
    consent: false,
    newsletter: false,
    features: [] as string[],
  });
  useEffect(() => {
    let active = true;
    api<Copy>("newsletter/copy?locale=" + locale)
      .then((c) => {
        if (active) {
          setCopy(c);
          setCopyError(false);
        }
      })
      .catch(() => {
        if (active) setCopyError(true);
      });
    return () => {
      active = false;
    };
  }, [locale, copyAttempt]);
  const copyReady = copy?.locale === locale;
  function update(name: string, value: string | boolean | string[]) {
    setData((d) => ({ ...d, [name]: value }));
    setError("");
  }
  const steps = [
    t("Standort", "Location"),
    t("Immobilienart", "Property type"),
    t("Details", "Details"),
    t("Kontakt", "Contact"),
  ];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!copyReady || !data.consent) return;
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({
        address: {
          street: data.street.trim(),
          postalCode: data.postalCode,
          city: data.city.trim(),
          country: "DE",
        },
        propertyType: data.propertyType,
        sizeSqm: Number(data.sizeSqm),
        rooms: data.rooms ? Number(data.rooms) : undefined,
        yearBuilt: Number(data.yearBuilt),
        condition: data.condition,
        features: data.features,
        sellingTimeline: data.sellingTimeline,
        sellerContact: {
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone || undefined,
        },
        dataProcessingConsent: data.consent,
        newsletterOptIn: data.newsletter,
        locale,
      });
      // Preserve the key for retries, but use a fresh request identity if edited after a failure.
      if (!key.current || sent.current !== body) {
        key.current = crypto.randomUUID();
        sent.current = body;
      }
      if (!token.current)
        token.current = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
      const result = await api<AssessmentCreated>("properties", {
        method: "POST",
        headers: {
          "idempotency-key": key.current,
          "x-assessment-token": token.current,
        },
        body,
      });
      sessionStorage.setItem("ve-assessment-" + result.id, token.current);
      router.push("/valuation/report/" + result.id);
    } catch (e) {
      setError(
        locale === "de-DE"
          ? "Die Anfrage konnte nicht abgeschlossen werden. Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut. Ihre Einwilligung bleibt freiwillig."
          : errorMessage(e),
      );
      setBusy(false);
    }
  }
  const field = (
    name: keyof typeof data,
    label: string,
    type = "text",
    extra: Record<string, string | number> = {},
  ) => (
    <label className="field">
      {label}
      <input
        name={name}
        type={type}
        value={String(data[name])}
        onChange={(e) => update(name, e.target.value)}
        required
        maxLength={200}
        {...extra}
      />
    </label>
  );
  const types: [[string, string], [string, string], [string, string]] = [
    ["APARTMENT", t("Wohnung", "Apartment")],
    ["HOUSE", t("Haus", "House")],
    ["LAND", t("Grundstück", "Land")],
  ];
  const features = [
    ["BALCONY", t("Balkon", "Balcony")],
    ["GARDEN", t("Garten", "Garden")],
    ["PARKING", t("Stellplatz", "Parking")],
    ["ELEVATOR", t("Aufzug", "Elevator")],
    ["TERRACE", t("Terrasse", "Terrace")],
    ["BASEMENT", t("Keller", "Basement")],
  ];
  return (
    <main id="main" className="intake-layout seller-intake">
      <aside className="intake-sidebar">
        <Link className="text-link" href="/">
          ← {t("Zur Startseite", "Back to home")}
        </Link>
        <div>
          <p className="eyebrow">
            {t("IHRE IMMOBILIE IM FOKUS", "YOUR PROPERTY IN FOCUS")}
          </p>
          <h2>
            {t(
              "Ein guter Plan beginnt mit Ihren Details.",
              "A good plan starts with your details.",
            )}
          </h2>
          <p>
            {t(
              "Wir führen Sie Schritt für Schritt durch Ihre Anfrage.",
              "We’ll guide you through your request, one step at a time.",
            )}
          </p>
        </div>
        <ol>
          {steps.map((s, i) => (
            <li
              key={s}
              className={i === step ? "current" : i < step ? "complete" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span>{i < step ? "✓" : "0" + (i + 1)}</span>
              <div>
                {s}
                <small>
                  {i === step
                    ? t("Aktueller Schritt", "Current step")
                    : i < step
                      ? t("Abgeschlossen", "Completed")
                      : t("Als Nächstes", "Coming up")}
                </small>
              </div>
            </li>
          ))}
        </ol>
        <p className="sidebar-note">
          {t(
            "Kein Konto erforderlich. Newsletter nur auf Wunsch und nach E-Mail-Bestätigung.",
            "No account required. Newsletter only if requested and confirmed by email.",
          )}
        </p>
      </aside>
      <div className="intake">
        <div className="step-caption">
          <span>
            {t("SCHRITT", "STEP")} {step + 1} / 4
          </span>
          <span>⌑ {t("IHRE PRIVATE ANFRAGE", "YOUR PRIVATE REQUEST")}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={t("Fortschritt", "Progress")}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={step + 1}
        >
          <span style={{ width: (step + 1) * 25 + "%" }} />
        </div>
        <h1>
          {
            [
              t("Wo ist Ihre Immobilie?", "Where is your property?"),
              t("Was macht sie aus?", "What kind of space is it?"),
              t("Die Details zählen.", "The details matter."),
              t("Fast geschafft.", "Nearly there."),
            ][step]
          }
        </h1>
        <p className="subtitle">
          {
            [
              t(
                "Beginnen wir mit dem Standort in Deutschland.",
                "Let’s start with its location in Germany.",
              ),
              t(
                "Wählen Sie die passende Immobilienart.",
                "Choose the property type that fits.",
              ),
              t(
                "Diese Angaben helfen, Ihre Immobilie einzuordnen.",
                "These details help put your property into context.",
              ),
              t(
                "Prüfen Sie Ihre Angaben und sagen Sie uns, wie wir Sie erreichen.",
                "Review your details and tell us how to reach you.",
              ),
            ][step]
          }
        </p>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          {step === 0 && (
            <>
              {field(
                "street",
                t("Straße und Hausnummer", "Street and house number"),
                "text",
                {
                  autoComplete: "street-address",
                  placeholder: "Musterstraße 12",
                  minLength: 2,
                },
              )}
              <div className="field-grid">
                {field("postalCode", t("Postleitzahl", "Postal code"), "text", {
                  pattern: "[0-9]{5}",
                  maxLength: 5,
                  inputMode: "numeric",
                  autoComplete: "postal-code",
                  placeholder: "80331",
                })}
                {field("city", t("Ort", "City"), "text", {
                  maxLength: 100,
                  autoComplete: "address-level2",
                  placeholder: "München",
                })}
              </div>
              <div className="notice">
                ⌖{" "}
                {t(
                  "Aktuell für Immobilien in Deutschland. Die Adresse wird zur Bewertung verwendet.",
                  "Currently for properties in Germany. The address is used for the assessment.",
                )}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div
                className="choice-grid"
                role="group"
                aria-label={t("Immobilienart", "Property type")}
              >
                {types.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      "choice " +
                      (data.propertyType === value ? "selected" : "")
                    }
                    aria-pressed={data.propertyType === value}
                    onClick={() => update("propertyType", value)}
                  >
                    <span aria-hidden="true">
                      <PropertyIcon type={value} />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
              <p className="notice">
                {t(
                  "Für selbst genutzte oder vermietete Wohnimmobilien und Grundstücke. Gewerbeimmobilien sind derzeit nicht enthalten.",
                  "For owner-occupied or rented residential property and land. Commercial property is not currently included.",
                )}
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <div className="field-grid">
                {field(
                  "sizeSqm",
                  data.propertyType === "LAND"
                    ? t("Grundstücksfläche (m²)", "Plot area (m²)")
                    : t("Wohnfläche (m²)", "Living area (m²)"),
                  "number",
                  { min: 1, max: 1000000, step: "0.1", placeholder: "100" },
                )}
                {field(
                  "yearBuilt",
                  t(
                    "Baujahr / Erschließungsjahr",
                    "Construction / development year",
                  ),
                  "number",
                  {
                    min: 1600,
                    max: new Date().getFullYear() + 5,
                    placeholder: "2000",
                  },
                )}
                <label className="field">
                  {t("Zimmer (optional)", "Rooms (optional)")}
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={data.rooms}
                    onChange={(e) => update("rooms", e.target.value)}
                  />
                </label>
                <label className="field">
                  {t("Zustand", "Condition")}
                  <select
                    value={data.condition}
                    onChange={(e) => update("condition", e.target.value)}
                  >
                    <option value="NEW">
                      {t(
                        "Neu / kürzlich renoviert",
                        "New / recently renovated",
                      )}
                    </option>
                    <option value="GOOD">{t("Gut", "Good")}</option>
                    <option value="NEEDS_RENOVATION">
                      {t("Renovierungsbedürftig", "Needs renovation")}
                    </option>
                  </select>
                </label>
              </div>
              <p>{t("Ausstattung (optional)", "Features (optional)")}</p>
              <div className="check-grid">
                {features.map(([value, label]) => (
                  <label className="check-label" key={value}>
                    <input
                      type="checkbox"
                      checked={data.features.includes(value)}
                      onChange={(e) =>
                        update(
                          "features",
                          e.target.checked
                            ? [...data.features, value]
                            : data.features.filter((x) => x !== value),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              {field("name", t("Vollständiger Name", "Full name"), "text", {
                autoComplete: "name",
                maxLength: 120,
              })}
              <div className="field-grid">
                {field("email", t("E-Mail-Adresse", "Email address"), "email", {
                  autoComplete: "email",
                  maxLength: 254,
                })}
                <label className="field">
                  {t("Telefon (optional)", "Phone (optional)")}
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={25}
                    pattern="[+0-9 ()-]{6,25}"
                    value={data.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                {t(
                  "Wann möchten Sie verkaufen?",
                  "When are you considering selling?",
                )}
                <select
                  value={data.sellingTimeline}
                  onChange={(e) => update("sellingTimeline", e.target.value)}
                >
                  {[
                    ["EXPLORING", t("Ich orientiere mich", "Just exploring")],
                    ["ASAP", t("So bald wie möglich", "As soon as possible")],
                    [
                      "THREE_MONTHS",
                      t("In den nächsten 3 Monaten", "Within 3 months"),
                    ],
                    [
                      "SIX_MONTHS",
                      t("In den nächsten 6 Monaten", "Within 6 months"),
                    ],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <div className="intake-summary">
                <span className="eyebrow">
                  {t("IHRE ZUSAMMENFASSUNG", "YOUR SUMMARY")}
                </span>
                <strong>
                  {data.street}, {data.postalCode} {data.city}
                </strong>
                <span>
                  {types.find(([v]) => v === data.propertyType)?.[1]} ·{" "}
                  {data.sizeSqm} m² · {data.yearBuilt}
                </span>
                <small>
                  {t(
                    "Die Wertspanne wird von einem lizenzierten Anbieter geliefert. Verfügbarkeit und Bearbeitungszeit hängen vom Objekt und Anbieter ab.",
                    "The value range is supplied by a licensed provider. Availability and timing depend on the property and provider.",
                  )}
                </small>
              </div>
              {copyReady ? (
                <div className="consent-section">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      required
                      checked={data.consent}
                      onChange={(e) => update("consent", e.target.checked)}
                    />
                    <span>{copy.processing}</span>
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={data.newsletter}
                      onChange={(e) => update("newsletter", e.target.checked)}
                    />
                    <span>
                      <strong>
                        {t("Optional: Newsletter", "Optional: newsletter")}
                      </strong>
                      <br />
                      {copy.newsletter}
                    </span>
                  </label>
                  <small>
                    {t(
                      "Ohne Newsletter erhalten Sie dieselbe Einschätzung.",
                      "You receive the same assessment without subscribing.",
                    )}
                  </small>
                </div>
              ) : (
                <div className="notice" role="status">
                  {copyError
                    ? t(
                        "Einwilligungstexte konnten nicht geladen werden.",
                        "Consent text could not be loaded.",
                      )
                    : t(
                        "Einwilligungstexte werden geladen …",
                        "Loading consent text …",
                      )}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setCopyAttempt((x) => x + 1)}
                  >
                    {t("Erneut laden", "Retry")}
                  </button>
                </div>
              )}
            </>
          )}
          <div className="form-actions">
            {step > 0 ? (
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                ← {t("Zurück", "Previous")}
              </button>
            ) : (
              <span />
            )}
            <button
              className="button"
              disabled={busy || (step === 3 && !copyReady)}
              type="submit"
            >
              {busy
                ? t("Wird gespeichert …", "Saving …")
                : step === 3
                  ? t("Einschätzung anfragen", "Request my assessment")
                  : t("Weiter", "Continue")}{" "}
              →
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
