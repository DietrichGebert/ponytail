"use client";
import type { components } from "@/lib/generated/api-types";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, errorMessage, type Identity } from "@/lib/api";
import { WorkspaceNav } from "@/components/workspace-nav";
import { useLocale } from "@/components/locale-provider";
import { humanLabel } from "@/lib/labels";
type Booking = components["schemas"]["BrokerBooking"];
export default function Bookings() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<Identity | null>(null),
    [items, setItems] = useState<Booking[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(await api<Booking[]>("broker/bookings"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.replace("/broker/login");
      else setError(errorMessage(e));
    }
  }, [router]);
  useEffect(() => {
    let live = true;
    Promise.all([api<Identity>("auth/me"), api<Booking[]>("broker/bookings")])
      .then(([identity, result]) => {
        if (live) {
          setUser(identity);
          setItems(result);
        }
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401)
          router.replace("/broker/login");
        else setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [router]);
  async function slot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("broker/slots", {
        method: "POST",
        body: JSON.stringify({
          startsAt: new Date(String(f.get("startsAt"))).toISOString(),
          endsAt: new Date(String(f.get("endsAt"))).toISOString(),
        }),
      });
      setMessage(
        t(
          "Zeit gespeichert. Ein Termin wird erst bestätigt, wenn der Kalender ihn annimmt.",
          "Availability saved. The calendar will be checked before a booking is confirmed.",
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="page-shell broker-workspace">
      <div className="page-heading workspace-hero">
        <div>
          <p className="eyebrow">
            {t("VISION ESTATES · TERMINE", "VISION ESTATES · APPOINTMENTS")}
          </p>
          <h1>{t("Zeit für das Gespräch.", "Make room for the next conversation.")}</h1>
          <p className="subtitle">
            {t(
              "Tragen Sie freie Zeiten ein. Verkäufer sehen sie erst, wenn ihr Value Signal vorliegt.",
              "Add open times. Sellers see them only after their Value Signal is ready.",
            )}
          </p>
        </div>
      </div>
      <WorkspaceNav role={user?.role} active="bookings" />
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div className="detail-grid">
        <section>
          <div className="toolbar">
            <h2 style={{ fontSize: 26, margin: 0 }}>
              {t("Terminanfragen", "Consultation requests")}
            </h2>
            <button className="button secondary" onClick={load}>
              {t("Aktualisieren", "Refresh")} ↻
            </button>
          </div>
          {items.length ? (
            items.map((b) => (
              <article className="card" key={b.id}>
                <span className="badge">{humanLabel(t, "booking", b.status)}</span>
                <h3>{b.property.sellerContact.name}</h3>
                <p>{b.property.address.street}</p>
                <p>
                  {b.slot
                    ? `${new Date(b.slot.startsAt).toLocaleString(locale)} · ${b.slot.broker.name}`
                    : t("Zeit freigegeben", "Time released")}
                </p>
                {b.status === "CALENDAR_REVIEW_REQUIRED" && (
                  <div className="notice">
                    {t(
                      "Die Kalenderbestätigung ist unsicher. Prüfen Sie den Kalender, bevor Sie dem Verkäufer einen Termin zusagen.",
                      "Calendar confirmation failed or its outcome is uncertain. Check the broker calendar before confirming anything with the seller.",
                    )}
                  </div>
                )}
                {b.status === "CANCEL_RECONCILIATION" && (
                  <div className="notice">
                    <p>
                      {t(
                        "Der Verkäufer hat abgesagt. Prüfen Sie den externen Kalender und geben Sie die Zeit erst danach frei. Diese Aktion löscht keinen Kalendereintrag.",
                        "The seller cancelled. Check the external calendar, then release the time. This action does not delete a calendar event.",
                      )}
                    </p>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await api("bookings/" + b.id + "/reconcile", {
                            method: "POST",
                          });
                          setMessage(
                            t(
                              "Zeit freigegeben. Der Kalender wurde von hier nicht geändert.",
                              "Time released. The calendar was not changed from here.",
                            ),
                          );
                          await load();
                        } catch (e) {
                          setError(errorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t("Zeit freigeben", "Release the time")}
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h2>{t("Noch keine Termine.", "No consultations yet.")}</h2>
              <p>
                {t(
                  "Anfragen erscheinen hier, sobald ein Verkäufer eine Ihrer Zeiten wählt.",
                  "Requests appear here when a seller chooses one of your times.",
                )}
              </p>
            </div>
          )}
        </section>
        <aside className="card">
          <p className="eyebrow">{t("IHRE ZEITEN", "YOUR AVAILABILITY")}</p>
          <h2>{t("Eine Zeit anbieten.", "Offer a consultation time.")}</h2>
          <p>
            {t(
              "Zeiten gelten in Ihrer lokalen Zeitzone. Höchstens zwei Stunden.",
              "Times use your local timezone. Maximum duration: two hours.",
            )}
          </p>
          <form onSubmit={slot}>
            <label className="field">
              {t("Beginn", "Start")}
              <input type="datetime-local" name="startsAt" required />
            </label>
            <label className="field">
              {t("Ende", "End")}
              <input type="datetime-local" name="endsAt" required />
            </label>
            <button className="button" disabled={busy}>
              {t("Zeit speichern", "Add availability")} →
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
