"use client";
import { money, type Report } from "@/lib/api";
import { useLocale } from "./locale-provider";
export function ReportContent({ report }: { report: Report }) {
  const { locale, t } = useLocale();
  return (
    <>
      <div className="value-card">
        <p className="eyebrow">
          {t("IHRE ORIENTIERENDE WERTSPANNE", "YOUR INDICATIVE PROPERTY VALUE")}
        </p>
        <strong>
          {money(report.valueRange.low)} – {money(report.valueRange.high)}
        </strong>
        <p>
          {t("Datenqualität", "Confidence")}:{" "}
          {
            {
              HIGH: t("hoch", "high"),
              MEDIUM: t("mittel", "medium"),
              LOW: t("niedrig", "low"),
              UNKNOWN: t("unbekannt", "unknown"),
            }[report.confidence]
          }{" "}
          · {report.provider}
        </p>
        <small>
          {t("Anbieterbewertung vom", "Provider assessment as of")}{" "}
          {new Date(report.asOf).toLocaleDateString(locale)}.{" "}
          {t(
            "Eine Orientierung, kein garantierter Verkaufspreis.",
            "An indicative assessment, not a guaranteed sale price.",
          )}
        </small>
      </div>
      <div className="card">
        <h2>{t("Was den Wert prägt.", "The story behind the value.")}</h2>
        {report.locale &&
          report.locale !== locale &&
          !(locale === "en" && report.locale === "en-GB") && (
            <p className="notice">
              {t(
                "Dieser Bericht wurde in der Sprache Ihrer Anfrage erstellt. Originalinhalte werden nicht automatisch übersetzt.",
                "This report was created in your submission language. Original content is not automatically translated.",
              )}
            </p>
          )}
        <section className="report-section">
          <h3>{t("Chancen & Stärken", "Opportunities & strengths")}</h3>
          <ul>
            {report.keyDrivers.opportunities.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="report-section">
          <h3>{t("Risiken & Prüfpunkte", "Risks & considerations")}</h3>
          <ul>
            {report.keyDrivers.risks.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="report-section">
          <h3>{t("Marktumfeld", "Market context")}</h3>
          <p>{report.marketContext}</p>
        </section>
        {report.tier === "FULL" && (
          <section className="strategy-section">
            <h3>{t("Ihre Verkaufsstrategie", "Your sales strategy")}</h3>
            {report.buyerPositioning && (
              <>
                <h4>{t("Positionierung", "Buyer positioning")}</h4>
                <p>{report.buyerPositioning}</p>
              </>
            )}
            {report.salesRoute && (
              <>
                <h4>
                  {t("Empfohlener Verkaufsweg", "Recommended sales route")}
                </h4>
                <p>{report.salesRoute}</p>
              </>
            )}
            {report.recommendation && <p>{report.recommendation}</p>}
            {report.strategy && (
              <ol>
                {report.strategy.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
          </section>
        )}
        <section className="report-section">
          <h3>{t("Offene Punkte", "Open questions")}</h3>
          <ol>
            {report.openPoints.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
        {report.explanationSource === "FACTUAL_FALLBACK" && (
          <small>
            {t(
              "Eine sachliche Zusammenfassung wird angezeigt, solange die erweiterte Einordnung nicht verfügbar ist.",
              "A factual summary is shown while the extended explanation is unavailable.",
            )}
          </small>
        )}
      </div>
    </>
  );
}
