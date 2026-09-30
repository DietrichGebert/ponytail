"use client";
import Link from "next/link";
import { PropertyIcon } from "./property-icon";
import { useLocale } from "./locale-provider";

export default function EstateHome() {
  const { t } = useLocale();
  return (
    <main id="main" className="estate-home">
      <section className="estate-hero container">
        <div className="hero-stage">
        <div className="estate-hero-copy">
          <p className="eyebrow">
            <span className="live-dot" />{" "}
            {t(
              "IMMOBILIEN VERSTEHEN. KLAR ENTSCHEIDEN.",
              "PROPERTY INSIGHT. CLEARER DECISIONS.",
            )}
          </p>
          <h1>
            {t("Ihr Zuhause.", "Your home.")}
            <br />
            {t("Sein Potenzial.", "Its potential.")}
            <br />
            <em>{t("Ihr nächster Schritt.", "Your next chapter.")}</em>
          </h1>
          <p className="hero-description">
            {t(
              "Eine fundierte Werteinschätzung. Ein klarer Weg nach vorn. Und ein Mensch, der Ihre Immobilie mit Ihnen versteht.",
              "A grounded assessment. A clear path forward. And a real person to help you understand what comes next.",
            )}
          </p>
          <div className="hero-actions">
            <Link className="button" href="/valuation/start">
              {t("Meine Immobilie einschätzen", "Assess my property")} ↗
            </Link>
            <a className="text-link" href="#method">
              {t("So funktioniert es", "How it works")} ↓
            </a>
          </div>
          <div className="hero-reassurance">
            <span>✓ {t("Ohne Konto starten", "Start without an account")}</span>
            <span>✓ {t("Keine Verkaufspflicht", "No commitment to sell")}</span>
          </div>
        </div>
        <div className="architecture-scene">
          <img
            src="/hero-building.png"
            alt={t(
              "Großes modernes Wohngebäude in der Dämmerung, 3D-Architekturansicht",
              "Large modern residential building at dusk, 3D architectural view",
            )}
          />
          <span className="scene-label">
            VISION / 01
            <br />
            {t("RAUM FÜR MÖGLICHKEITEN", "SPACE FOR POSSIBILITY")}
          </span>
          <div className="scene-caption">
            <span className="scene-icon">⌂</span>
            <div>
              <strong>{t("Mehr als eine Zahl.", "More than a number.")}</strong>
              <small>
                {t(
                  "Wert, Kontext und persönliche Perspektive.",
                  "Value, context and a personal perspective.",
                )}
              </small>
            </div>
            <span>↗</span>
          </div>
        </div>
        </div>
      </section>
      <section
        className="property-entry container"
        aria-labelledby="property-title"
      >
        <div>
          <p className="eyebrow">{t("DER ERSTE SCHRITT", "THE FIRST STEP")}</p>
          <h2 id="property-title">
            {t(
              "Was möchten Sie einschätzen?",
              "What would you like to assess?",
            )}
          </h2>
        </div>
        <div className="property-entry-options">
          {[
            ["APARTMENT", t("Wohnung", "Apartment")],
            ["HOUSE", t("Haus", "House")],
            ["LAND", t("Grundstück", "Land")],
          ].map(([type, label]) => (
            <Link key={type} href={"/valuation/start?type=" + type}>
              <PropertyIcon type={type} />
              <strong>{label}</strong>
              <span>↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="container process-section" id="method">
        <div className="section-intro">
          <p className="eyebrow">
            {t("VON DER FRAGE ZUR KLARHEIT", "FROM QUESTIONS TO CLARITY")}
          </p>
          <h2>
            {t(
              "Sie wissen immer,\nwas als Nächstes kommt.",
              "Always know\nwhat comes next.",
            )}
          </h2>
          <p>
            {t(
              "Vier klare Schritte. Keine voreiligen Entscheidungen. Sie behalten den Überblick.",
              "Four clear steps. No rushed decisions. You stay in the picture.",
            )}
          </p>
        </div>
        <div className="process-cards">
          {[
            [
              t("Immobilie beschreiben", "Tell us about your property"),
              t(
                "Standort, Ausstattung und Ihre Pläne – Schritt für Schritt erfasst.",
                "Location, features and your plans, captured step by step.",
              ),
            ],
            [
              t("Value Signal erhalten", "Receive your Value Signal"),
              t(
                "Eine Preisspanne des Bewertungsanbieters, Einflussfaktoren und offene Fragen.",
                "A provider-supplied value range, its drivers and open questions.",
              ),
            ],
            [
              t("Persönlich besprechen", "Have a conversation"),
              t(
                "Ihr Makler prüft den Fall und bespricht die Einordnung mit Ihnen.",
                "Your broker reviews your case and discusses the assessment with you.",
              ),
            ],
            [
              t("Strategie verstehen", "Understand the strategy"),
              t(
                "Nach Prüfung und Freigabe erhalten Sie den ausführlichen Bericht.",
                "After review and release, your full report becomes available.",
              ),
            ],
          ].map(([title, body], i) => (
            <article key={i}>
              <span className="process-index">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container insight-section" id="vision">
        <div>
          <p className="eyebrow">
            {t(
              "FUNDIERT. VERSTÄNDLICH. PERSÖNLICH.",
              "GROUNDED. CLEAR. PERSONAL.",
            )}
          </p>
          <h2>
            {t(
              "Eine Zahl allein\nist noch kein Plan.",
              "A number alone\nis not a plan.",
            )}
          </h2>
          <p>
            {t(
              "Wir verbinden die Bewertung eines lizenzierten Anbieters mit einer verständlichen Einordnung und dem persönlichen Blick eines Maklers.",
              "We connect a licensed provider’s valuation with a clear explanation and a broker’s personal perspective.",
            )}
          </p>
          <Link className="button accent" href="/valuation/start">
            {t("Meinen ersten Schritt machen", "Take my first step")} ↗
          </Link>
        </div>
        <div className="report-preview">
          <div className="preview-heading">
            <span>VISION ESTATES</span>
            <span>VALUE SIGNAL</span>
          </div>
          <h3>
            {t(
              "Die Grundlagen Ihrer Entscheidung",
              "The foundations of your decision",
            )}
          </h3>
          {[
            t("Wertspanne & Datenqualität", "Value range & data quality"),
            t("Chancen & Risiken", "Opportunities & risks"),
            t("Marktumfeld & offene Punkte", "Market context & open questions"),
          ].map((s, i) => (
            <div className="preview-row" key={s}>
              <span>0{i + 1}</span>
              <strong>{s}</strong>
              <span>✓</span>
            </div>
          ))}
          <div className="preview-lock">
            ⌑{" "}
            {t(
              "Verkaufsstrategie nach persönlicher Prüfung",
              "Sales strategy after a personal review",
            )}
          </div>
          <small>
            {t(
              "Berichtsstruktur – keine Beispielbewertung.",
              "Report structure, not a sample valuation.",
            )}
          </small>
        </div>
      </section>
      <section className="container faq-section">
        <div>
          <p className="eyebrow">{t("GUT ZU WISSEN", "GOOD TO KNOW")}</p>
          <h2>
            {t(
              "Ihre Fragen.\nKlare Antworten.",
              "Your questions.\nClear answers.",
            )}
          </h2>
        </div>
        <div className="faq-list">
          {[
            [
              t("Brauche ich ein Konto?", "Do I need an account?"),
              t(
                "Nein. Sie können Ihre Immobilie ohne Anmeldung erfassen. Ihre Einschätzung ist derzeit über den Browser-Tab zugänglich, in dem Sie die Anfrage absenden. Bewahren Sie diesen Tab auf.",
                "No. Submit without signing in. Your assessment is currently accessible from the browser tab used to submit it. Keep that tab open.",
              ),
            ],
            [
              t(
                "Woher kommt die Bewertung?",
                "Where does the valuation come from?",
              ),
              t(
                "Der Wert stammt von einem lizenzierten Bewertungsanbieter. Solange keine Bewertung vorliegt, bleibt Ihre Anfrage in Bearbeitung. Es wird kein Preis erfunden.",
                "The value comes from a licensed provider. Until a result is available, your assessment stays pending. No price is invented.",
              ),
            ],
            [
              t(
                "Verpflichte ich mich zum Verkauf?",
                "Am I committing to sell?",
              ),
              t(
                "Nein. Eine Anfrage verpflichtet Sie nicht zum Verkauf. Sie entscheiden nach der Einordnung und dem persönlichen Gespräch.",
                "No. An assessment request does not commit you to a sale. You decide after reviewing the facts and speaking with a broker.",
              ),
            ],
            [
              t(
                "Wann erhalte ich den vollständigen Bericht?",
                "When do I receive the full report?",
              ),
              t(
                "Zuerst sehen Sie das kompakte Value Signal. Den vollständigen Bericht gibt Ihr Makler nach einem Gespräch und der Prüfung ausdrücklich frei.",
                "You first see the compact Value Signal. Your broker explicitly releases the full report after your conversation and review.",
              ),
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="container closing-card">
        <p className="eyebrow">
          {t("IHR ZUHAUSE HAT EINE GESCHICHTE.", "YOUR HOME HAS A STORY.")}
        </p>
        <h2>
          {t(
            "Schreiben wir das nächste Kapitel.",
            "Let’s write the next chapter.",
          )}
        </h2>
        <Link className="button" href="/valuation/start">
          {t("Immobilie einschätzen", "Assess my property")} ↗
        </Link>
      </section>
    </main>
  );
}
