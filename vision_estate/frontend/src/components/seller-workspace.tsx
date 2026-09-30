"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { components } from "@/lib/generated/api-types";
import {
  api,
  ApiError,
  assessmentHeaders,
  errorMessage,
  type Report,
} from "@/lib/api";
import { useLocale } from "./locale-provider";
import { ReportContent } from "./report-content";
type Status = components["schemas"]["AssessmentStatus"];
type Slot = components["schemas"]["AvailableSlot"];
type Booking = { status: string; slot?: { startsAt: string } };
export default function SellerWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null),
    [signal, setSignal] = useState<Report | null>(null),
    [full, setFull] = useState<Report | null>(null),
    [tab, setTab] = useState("signal"),
    [error, setError] = useState<unknown>(null),
    [refresh, setRefresh] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]),
    [selected, setSelected] = useState(""),
    [booking, setBooking] = useState<Booking | null>(null),
    [bookingError, setBookingError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [slotsLoaded, setSlotsLoaded] = useState(false);
  useEffect(() => {
    let active = true,
      attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function load() {
      try {
        const s = await api<Status>(`properties/${id}/status`, {
          headers: assessmentHeaders(id),
          signal: abort.signal,
        });
        if (!active) return;
        setStatus(s);
        setError(null);
        if (s.state === "REPORT_READY") {
          const r = await api<Report>(`properties/${id}/report/value-signal`, {
            headers: assessmentHeaders(id),
            signal: abort.signal,
          });
          if (!active) return;
          setSignal(r);
          try {
            const b = await api<Booking[]>(`properties/${id}/bookings`, {
              headers: assessmentHeaders(id),
              signal: abort.signal,
            });
            if (active) {
              const latest = b[0] || null;
              setBooking(
                latest && latest.status !== "CANCELLED" ? latest : null,
              );
              setBookingError(null);
            }
          } catch (e) {
            if (active) setBookingError(e);
          }
        }
        if (active && !s.processingError && attempts++ < 12)
          timer = setTimeout(load, 5000);
      } catch (e) {
        if (active) setError(e);
      }
    }
    void load();
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timer);
    };
  }, [id, refresh]);
  function message(e: unknown) {
    if (locale === "en") return errorMessage(e);
    if (e instanceof ApiError && e.status === 403)
      return "Diese Einschätzung ist privat. Öffnen Sie den ursprünglichen Browser-Tab Ihrer Anfrage.";
    return "Die Daten sind momentan nicht verfügbar. Bitte versuchen Sie es erneut. Ihre Anfrage wird dadurch nicht erneut erstellt.";
  }
  async function loadSlots() {
    setBusy(true);
    setBookingError(null);
    try {
      const s = await api<{ items: Slot[] }>(`properties/${id}/slots`, {
        headers: assessmentHeaders(id),
      });
      setSlots(s.items);
      setSlotsLoaded(true);
      setSelected("");
    } catch (e) {
      setBookingError(e);
    } finally {
      setBusy(false);
    }
  }
  async function book() {
    setBusy(true);
    setBookingError(null);
    try {
      const b = await api<Booking>(`properties/${id}/bookings`, {
        method: "POST",
        headers: assessmentHeaders(id),
        body: JSON.stringify({ slotId: selected }),
      });
      setBooking(b.status === "CANCELLED" ? null : b);
    } catch (e) {
      setBookingError(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancelBooking() {
    setBusy(true);
    setBookingError(null);
    try {
      const b = await api<Booking>(`properties/${id}/bookings/cancel`, {
        method: "POST",
        headers: assessmentHeaders(id),
      });
      setBooking(b.status === "CANCELLED" ? null : b);
      setSlots([]);
      setSlotsLoaded(false);
      setSelected("");
    } catch (e) {
      setBookingError(e);
    } finally {
      setBusy(false);
    }
  }
  async function showFull() {
    if (full) {
      setTab("full");
      return;
    }
    setBusy(true);
    try {
      setFull(
        await api<Report>(`properties/${id}/report/full`, {
          headers: assessmentHeaders(id),
        }),
      );
      setTab("full");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const milestones = [
    t("Angaben erhalten", "Details received"),
    t("Value Signal", "Value Signal"),
    t("Persönliche Prüfung", "Personal review"),
    t("Vollständiger Bericht", "Full report"),
  ];
  const stage = signal?.fullReport?.available
    ? 4
    : status?.reviewedAt
      ? 3
      : signal
        ? 2
        : 1;
  const report = tab === "full" && full ? full : signal;
  const next =
    status?.processingError
      ? {
          title: t("Wir prüfen Ihre Anfrage.", "We are checking your request."),
          body: t(
            "Ihre Angaben sind gespeichert. Sobald die Bewertung vorliegt, sehen Sie sie hier. Es wird kein geschätzter Preis angezeigt.",
            "Your details are saved. The assessment appears here when it is ready. No estimated price is shown.",
          ),
        }
      : !signal
        ? {
            title: t("Angaben sind angekommen.", "Your details are in."),
            body: t(
              "Als Nächstes erstellt der Bewertungsanbieter Ihr Value Signal. Sie müssen nichts weiter tun. Diese Seite bleibt Ihr Ort für Status, Bericht und Termin.",
              "Next, the valuation provider prepares your Value Signal. You do not need to do anything else. This page is where status, report and appointment stay.",
            ),
          }
        : booking?.status === "CANCEL_RECONCILIATION"
          ? {
              title: t("Termin abgesagt.", "Appointment cancelled."),
              body: t(
                "Ihr Makler prüft noch den Kalender. Bis dahin ist die Zeit nicht wieder frei.",
                "Your broker still needs to check the calendar. The time stays held until then.",
              ),
            }
          : booking?.status === "CONFIRMED"
          ? {
              title: t("Ihr Termin steht.", "Your appointment is set."),
              body: t(
                "Bereiten Sie Fragen zur Immobilie vor. Den vollständigen Bericht gibt Ihr Makler nach dem Gespräch frei.",
                "Prepare your questions about the property. Your broker releases the full report after the conversation.",
              ),
            }
          : booking
            ? {
                title: t("Termin angefragt.", "Appointment requested."),
                body: t(
                  "Die Bestätigung folgt, sobald der Kalender den Termin angenommen hat. Bis dahin gilt er noch nicht als fest.",
                  "Confirmation follows once the calendar accepts the time. Until then it is not confirmed.",
                ),
              }
            : signal.fullReport?.available
              ? {
                  title: t("Ihr vollständiger Bericht ist da.", "Your full report is ready."),
                  body: t(
                    "Öffnen Sie den Bericht und sprechen Sie offene Punkte mit Ihrem Makler.",
                    "Open the report and talk through any open points with your broker.",
                  ),
                }
              : {
                  title: t("Value Signal ansehen, dann Termin wählen.", "Read the Value Signal, then pick a time."),
                  body: t(
                    "Die Preisspanne steht. Wählen Sie rechts eine Zeit für das Gespräch. Die Verkaufsstrategie folgt erst nach der persönlichen Prüfung.",
                    "The value range is ready. Choose a time on the right for your conversation. Sales strategy follows only after a personal review.",
                  ),
                };
  return (
    <main id="main" className="seller-workspace">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">
            {t("IHR IMMOBILIENKOMPASS", "YOUR PROPERTY COMPASS")}
          </p>
          <h1>
            {t(
              "Ihr nächster Schritt. Im Blick.",
              "Your next chapter. In view.",
            )}
          </h1>
          <p>
            {status
              ? `${status.address.street} · ${status.address.postalCode} ${status.address.city}`
              : t("Ihre private Einschätzung", "Your private assessment")}
          </p>
        </div>
        {status && (
          <span className="workspace-status">
            {status.processingError
              ? t("Prüfung ausstehend", "Review pending")
              : signal
                ? t("Value Signal verfügbar", "Value Signal available")
                : t("Anfrage gespeichert", "Request saved")}
          </span>
        )}
      </div>
      {error !== null && (
        <div className="error" role="alert">
          <p>{message(error)}</p>
          <button
            className="button secondary"
            onClick={() => setRefresh((x) => x + 1)}
          >
            {t("Erneut versuchen", "Try again")} ↻
          </button>
        </div>
      )}
      {!status && error === null && (
        <div className="loading" role="status">
          <span className="spinner" />
          <p>
            {t("Ihre Einschätzung wird geladen …", "Loading your assessment …")}
          </p>
        </div>
      )}
      {status && (
        <>
          <ol
            className="seller-milestones"
            aria-label={t("Ihr Fortschritt", "Your progress")}
          >
            {milestones.map((label, i) => (
              <li
                key={label}
                className={i < stage ? "done" : i === stage ? "current" : ""}
                aria-current={i === stage ? "step" : undefined}
              >
                <span className="milestone-number">
                  {i < stage ? "✓" : i + 1}
                </span>
                <div>
                  <strong>{label}</strong>
                  <small>
                    {i < stage
                      ? t("Abgeschlossen", "Completed")
                      : i === stage
                        ? t("Nächster Schritt", "Next step")
                        : t("Danach", "Later")}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <section className="next-action" aria-live="polite">
            <p className="eyebrow">{t("IHR NÄCHSTER SCHRITT", "YOUR NEXT STEP")}</p>
            <h2>{next.title}</h2>
            <p>{next.body}</p>
          </section>
          <div className="seller-columns">
            <div>
              {!report ? (
                <section className="pending-assessment">
                  <div className="pending-symbol" aria-hidden="true">
                    ⌂
                  </div>
                  <p className="eyebrow">
                    {t("ALLES AN EINEM ORT", "EVERYTHING IN ONE PLACE")}
                  </p>
                  <h2>
                    {status.processingError
                      ? t(
                          "Ihre Einschätzung braucht noch etwas Zeit.",
                          "Your assessment needs a little more time.",
                        )
                      : t(
                          "Der erste Schritt ist gemacht.",
                          "You’ve taken the first step.",
                        )}
                  </h2>
                  <p>
                    {t(
                      "Ihre Immobilienangaben sind gespeichert. Hier erscheint Ihr Value Signal, sobald die Bewertung eines lizenzierten Anbieters vorliegt. Anschließend besprechen Sie die Ergebnisse mit Ihrem Makler.",
                      "Your property details are saved. Your Value Signal will appear here once a licensed provider’s assessment is available. You can then discuss the results with your broker.",
                    )}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setRefresh((x) => x + 1)}
                  >
                    {t("Status aktualisieren", "Refresh status")} ↻
                  </button>
                  <div className="pending-note">
                    <span>⌑</span>
                    {t(
                      "Bewahren Sie diesen Browser-Tab auf. Zugriff von anderen Geräten ist derzeit nicht verfügbar.",
                      "Keep this browser tab open. Access from another device is not currently available.",
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <div
                    className="report-tabs"
                    role="group"
                    aria-label={t("Berichtsauswahl", "Choose report")}
                  >
                    <button
                      aria-pressed={tab === "signal"}
                      onClick={() => setTab("signal")}
                    >
                      Value Signal
                    </button>
                    <button
                      aria-pressed={tab === "full"}
                      disabled={!signal?.fullReport?.available || busy}
                      onClick={showFull}
                    >
                      {signal?.fullReport?.available ? "" : "⌑ "}
                      {t("Vollständiger Bericht", "Full report")}
                    </button>
                  </div>
                  <ReportContent report={report} />
                  <div className="report-actions">
                    <button
                      className="button secondary"
                      onClick={() => window.print()}
                    >
                      {t("Drucken / als PDF speichern", "Print / save as PDF")}
                    </button>
                    <button
                      className="text-link"
                      onClick={() => setRefresh((x) => x + 1)}
                    >
                      {t("Status aktualisieren", "Refresh status")} ↻
                    </button>
                  </div>
                </>
              )}
            </div>
            <aside className="workspace-aside">
              <section className="card">
                <p className="eyebrow">
                  {t("IHRE IMMOBILIE", "YOUR PROPERTY")}
                </p>
                <h3>{status.address.city}</h3>
                <p>
                  {status.address.street}
                  <br />
                  {status.sizeSqm} m² ·{" "}
                  {status.propertyType === "HOUSE"
                    ? t("Haus", "House")
                    : status.propertyType === "LAND"
                      ? t("Grundstück", "Land")
                      : t("Wohnung", "Apartment")}
                </p>
                <small>
                  {t("Anfrage vom", "Submitted on")}{" "}
                  {new Date(status.createdAt).toLocaleDateString(locale)}
                </small>
              </section>
              <section className="card booking-panel">
                <p className="eyebrow">
                  {t("PERSÖNLICHE BERATUNG", "PERSONAL ADVICE")}
                </p>
                <h3>
                  {t("Gemeinsam weiterdenken.", "Make sense of what’s next.")}
                </h3>
                <p>
                  {signal
                    ? t(
                        "Besprechen Sie Ihre Einschätzung mit Ihrem Makler. Terminzeiten werden in Ihrer lokalen Zeitzone angezeigt.",
                        "Discuss your assessment with your broker. Appointment times use your local timezone.",
                      )
                    : t(
                        "Sobald Ihr Value Signal vorliegt, können Sie verfügbare Beratungstermine prüfen.",
                        "Once your Value Signal is ready, you can check available consultation times.",
                      )}
                </p>
                {booking ? (
                  <div role="status" className="notice">
                    {booking.status === "CONFIRMED"
                      ? t(
                          "Ihr Termin ist bestätigt.",
                          "Your appointment is confirmed.",
                        )
                      : booking.status === "CANCEL_RECONCILIATION"
                        ? t(
                            "Die Absage ist gespeichert. Der Kalender muss noch geprüft werden.",
                            "The cancellation is saved. The calendar still needs to be checked.",
                          )
                      : booking.status === "CALENDAR_REVIEW_REQUIRED"
                        ? t(
                            "Die Kalenderbestätigung muss geprüft werden. Ihr Termin ist noch nicht bestätigt.",
                            "Calendar confirmation needs review. Your appointment is not confirmed yet.",
                          )
                        : t(
                            "Ihre Anfrage ist gespeichert. Die Kalenderbestätigung steht noch aus.",
                            "Your request is saved. Calendar confirmation is still pending.",
                          )}
                    {booking.slot && (
                      <p>
                        {new Date(booking.slot.startsAt).toLocaleString(locale)}
                      </p>
                    )}
                    <button
                      className="text-link"
                      onClick={() => setRefresh((x) => x + 1)}
                    >
                      {t("Bestätigung prüfen", "Check confirmation")}
                    </button>
                    {booking.status !== "CANCEL_RECONCILIATION" && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={cancelBooking}
                      >
                        {t("Termin absagen", "Cancel appointment")}
                      </button>
                    )}
                  </div>
                ) : (
                  signal && (
                    <>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={loadSlots}
                      >
                        {t("Termine ansehen", "View available times")} →
                      </button>
                      {slotsLoaded && !slots.length && (
                        <p role="status">
                          {t(
                            "Noch keine Termine verfügbar. Bitte schauen Sie später erneut nach.",
                            "No times available yet. Please check back later.",
                          )}
                        </p>
                      )}
                      <div className="slot-list">
                        {slots.map((s) => (
                          <button
                            key={s.id}
                            className={
                              "slot-button " +
                              (selected === s.id ? "selected" : "")
                            }
                            aria-pressed={selected === s.id}
                            onClick={() => setSelected(s.id)}
                          >
                            {new Date(s.startsAt).toLocaleString(locale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            <br />
                            <small>{s.broker.name}</small>
                          </button>
                        ))}
                      </div>
                      {selected && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={book}
                        >
                          {t("Termin anfragen", "Request appointment")} →
                        </button>
                      )}
                    </>
                  )
                )}
                {bookingError !== null && (
                  <div role="alert" className="notice">
                    {t(
                      "Die Terminverfügbarkeit konnte nicht geladen werden. Bitte versuchen Sie es später erneut.",
                      errorMessage(bookingError),
                    )}
                  </div>
                )}
              </section>
              <section className="card">
                <p className="eyebrow">
                  {t("DIE NÄCHSTE PERSPEKTIVE", "THE NEXT PERSPECTIVE")}
                </p>
                <h3>
                  {t("Strategie mit Augenmaß.", "Strategy with perspective.")}
                </h3>
                <p>
                  {t(
                    "Der vollständige Bericht ergänzt Positionierung, Verkaufsweg und Strategie. Ihr Makler gibt ihn nach dem Gespräch und der Prüfung persönlich frei.",
                    "Your full report adds positioning, a sales route and strategy. Your broker releases it personally after your conversation and review.",
                  )}
                </p>
                <span className="badge">
                  {signal?.fullReport?.available
                    ? t("Freigegeben", "Released")
                    : t("Freigabe ausstehend", "Release pending")}
                </span>
              </section>
              <Link href="/" className="text-link">
                ← {t("Zur Startseite", "Back to home")}
              </Link>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
