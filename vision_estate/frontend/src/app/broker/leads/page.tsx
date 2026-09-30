"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  errorMessage,
  type Lead,
  type Identity,
  type LeadPage,
} from "@/lib/api";
import { AssignLead } from "@/components/assign-lead";
import { ReportContent } from "@/components/report-content";
import { WorkspaceNav } from "@/components/workspace-nav";
import { useLocale } from "@/components/locale-provider";
import { humanLabel, pipelineStages } from "@/lib/labels";
type User = Identity;
export default function LeadsPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [leads, setLeads] = useState<Lead[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [appliedSearch, setAppliedSearch] = useState(""),
    [refresh, setRefresh] = useState(0),
    [filter, setFilter] = useState("ALL"),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    setRefresh((value) => value + 1);
  }, []);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page) });
    if (appliedSearch) query.set("q", appliedSearch);
    if (filter !== "ALL") query.set("stage", filter);
    Promise.all([
      api<User>("auth/me", { signal: controller.signal }),
      api<LeadPage>("leads?" + query, {
        signal: controller.signal,
      }),
    ])
      .then(([u, result]) => {
        if (live) {
          setUser(u);
          setLeads(result.items);
          setTotal(result.total);
          setPage(result.page);
          setError("");
        }
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401)
          router.replace("/broker/login");
        else setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [page, appliedSearch, filter, refresh, router]);
  async function action(path: string, method = "POST", body?: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ queued?: boolean }>(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setMessage(
        result?.queued === false
          ? t(
              "Kein fehlgeschlagener Auftrag zum erneuten Starten vorhanden. Bitte prüfen Sie den aktuellen Status.",
              "No failed job is available to retry. Please check the current status.",
            )
          : t("Änderungen gespeichert.", "Changes saved."),
      );
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const active = leads.find((l) => l.id === selected);
  const visible = leads;
  const guide = active
    ? !active.assignedToId && user?.role === "ADMIN"
      ? {
          title: t("Makler zuweisen", "Assign a broker"),
          body: t(
            "Ohne Zuweisung sieht kein Makler diese Anfrage. Wählen Sie unten die zuständige Person.",
            "No broker can see this request until it is assigned. Choose the owner below.",
          ),
        }
      : active.property.state !== "REPORT_READY"
        ? {
            title: t("Bewertung abwarten", "Wait for the valuation"),
            body: t(
              "Der Preis kommt vom lizenzierten Anbieter. Bis dahin keinen Wert nennen und den Verkäufer bei Bedarf kontaktieren.",
              "The price comes from the licensed provider. Do not quote a value until it arrives. You can still contact the seller.",
            ),
          }
        : !active.reviewedAt
          ? {
              title: t("Gespräch führen und Prüfung speichern", "Talk, then record the review"),
              body: t(
                "Value Signal ist da. Besprechen Sie es mit dem Verkäufer und speichern Sie danach die Prüfung. Erst dann kann der vollständige Bericht freigegeben werden.",
                "The Value Signal is ready. Discuss it with the seller, then record the review. The full report can be released only after that.",
              ),
            }
          : active.property.reports.some(
                (r) => r.tier === "FULL" && r.releaseState !== "RELEASED",
              )
            ? {
                title: t("Bericht freigeben", "Release the full report"),
                body: t(
                  "Die Prüfung ist gespeichert. Geben Sie den vollständigen Bericht frei, wenn die Strategie stimmt. Der Verkäufer sieht ihn erst danach.",
                  "The review is saved. Release the full report when the strategy is right. The seller sees it only after release.",
                ),
              }
            : {
                title: t("Gespräch fortsetzen", "Continue the conversation"),
                body: t(
                  "Notizen und Status halten das Team auf dem gleichen Stand. Der nächste Schritt steht im Statusfeld.",
                  "Notes and the stage keep the team aligned. Update the stage when the conversation moves.",
                ),
              }
    : null;
  return (
    <main id="main" className="page-shell broker-workspace">
      <div className="page-heading workspace-hero">
        <div>
          <p className="eyebrow">
            {t("VISION ESTATES · ARBEITSBEREICH", "VISION ESTATES · WORKSPACE")}
          </p>
          <h1>
            {active
              ? t("Diese Anfrage im Überblick.", "This request, in full.")
              : t("Ihre Anfragen.", "Your seller pipeline.")}
          </h1>
          <p className="subtitle">
            <span>
              {user
                ? t(`Willkommen, ${user.name}. `, `Welcome back, ${user.name}. `)
                : ""}
            </span>
            <span>
              {t(
                "Jede Anfrage hat einen klaren nächsten Schritt.",
                "Every request has a clear next step.",
              )}
            </span>
          </p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await api("auth/logout", { method: "POST" });
              router.push("/broker/login");
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          {t("Abmelden", "Sign out")} ↗
        </button>
      </div>
      <WorkspaceNav
        role={user?.role}
        active="leads"
        onLeads={() => setSelected(null)}
      />
      {error && (
        <div role="alert" className="error">
          <span>{error}</span>
          <button className="button secondary" onClick={load}>
            {t("Erneut versuchen", "Retry")}
          </button>
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      {loading && !user ? (
        <div className="loading">
          <span className="spinner" />
          <p>{t("Arbeitsbereich wird geladen …", "Loading your workspace…")}</p>
        </div>
      ) : !user ? null : active ? (
        <>
          <button className="text-link" onClick={() => setSelected(null)}>
            ← {t("Zurück zur Übersicht", "Back to pipeline")}
          </button>
          <div className="detail-grid">
            <div>
              <section className="card">
                <div className="page-heading">
                  <h2>{active.property.address.street}</h2>
                  <span className={"badge " + active.scoreBand}>
                    {`${humanLabel(t, "band", active.scoreBand)} · ${active.score}`}
                  </span>
                </div>
                <p>
                  {active.property.address.postalCode}{" "}
                  {active.property.address.city}
                </p>
                <dl className="detail-list">
                  {[
                    [t("Objekt", "Property"), humanLabel(t, "type", active.property.propertyType)],
                    [t("Fläche", "Area"), active.property.sizeSqm + " m²"],
                    [t("Baujahr", "Year built"), String(active.property.yearBuilt)],
                    [t("Zustand", "Condition"), humanLabel(t, "condition", active.property.condition)],
                    [t("Verkäufer", "Seller"), active.property.sellerContact.name],
                    [t("Zeitplan", "Timeline"), humanLabel(t, "timeline", active.property.sellingTimeline)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  <a
                    className="text-link"
                    href={"mailto:" + active.property.sellerContact.email}
                  >
                    {active.property.sellerContact.email}
                  </a>
                </p>
                {active.property.sellerContact.phone && (
                  <p>
                    <a href={"tel:" + active.property.sellerContact.phone}>
                      {active.property.sellerContact.phone}
                    </a>
                  </p>
                )}
                <p>
                  {t("Ausstattung", "Features")}:{" "}
                  {active.property.features
                    .map((feature) => feature.toLowerCase())
                    .join(", ") || t("Keine Angabe", "None supplied")}
                </p>
              </section>
              {active.property.state === "REPORT_READY" &&
              active.property.reports.find((r) => r.tier === "VALUE_SIGNAL") ? (
                <ReportContent
                  report={
                    active.property.reports.find(
                      (r) => r.tier === "VALUE_SIGNAL",
                    )!.payload
                  }
                />
              ) : (
                <div className="notice">
                  <strong>
                    {t("Bewertung noch offen", "Valuation pending")}
                  </strong>
                  <p>
                    {t(
                      "Ein Ergebnis des lizenzierten Anbieters liegt noch nicht vor. Es wird kein Preis angezeigt.",
                      "A licensed provider result is not available yet. No price is shown.",
                    )}
                  </p>
                  {active.property.processingError && (
                    <button
                      className="button secondary"
                      disabled={busy || loading}
                      onClick={() =>
                        action("leads/" + active.id + "/retry-valuation")
                      }
                    >
                      {t("Bewertung erneut anstoßen", "Retry valuation")}
                    </button>
                  )}
                </div>
              )}
            </div>
            <aside>
              {guide && (
                <section className="card next-step-card">
                  <p className="eyebrow">{t("JETZT TUN", "DO THIS NEXT")}</p>
                  <h2>{guide.title}</h2>
                  <p>{guide.body}</p>
                </section>
              )}
              {user?.role === "ADMIN" && (
                <AssignLead key={active.id} leadId={active.id} assignedToId={active.assignedToId} onAssigned={load} />
              )}
              <section className="card">
                <p className="eyebrow">{t("STATUS DER ANFRAGE", "REQUEST STATUS")}</p>
                <h2>{t("Wo steht das Gespräch?", "Where is the conversation?")}</h2>
                <label className="field">
                  {t("Status", "Stage")}
                  <select
                    disabled={busy || loading}
                    value={active.stage}
                    onChange={(e) =>
                      action("leads/" + active.id, "PATCH", {
                        stage: e.target.value,
                      })
                    }
                  >
                    {pipelineStages.map((s) => (
                      <option key={s} value={s}>
                        {humanLabel(t, "stage", s)}
                      </option>
                    ))}
                  </select>
                </label>
                <form
                  key={active.id + active.notes}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action("leads/" + active.id, "PATCH", {
                      notes: f.get("notes"),
                    });
                  }}
                >
                  <label className="field">
                    {t("Notizen", "Notes")}
                    <textarea
                      name="notes"
                      defaultValue={active.notes}
                      maxLength={5000}
                      placeholder={t(
                        "Was wurde besprochen? Was ist der nächste Schritt?",
                        "What was discussed? What happens next?",
                      )}
                    />
                  </label>
                  <button className="button secondary" disabled={busy || loading}>
                    {t("Notizen speichern", "Save notes")}
                  </button>
                </form>
                <hr />
                {active.reviewedAt ? (
                  <p>
                    {t("Prüfung gespeichert am", "Review recorded on")}{" "}
                    {new Date(active.reviewedAt).toLocaleDateString(locale)}.
                  </p>
                ) : null}
                {(!active.reviewedAt ||
                  active.property.reports.some(
                    (r) =>
                      r.tier === "FULL" &&
                      r.releaseState !== "RELEASED" &&
                      !r.reviewedAt,
                  )) && (
                  <button
                    className="button"
                    disabled={busy || loading}
                    onClick={() => action("leads/" + active.id + "/review")}
                  >
                    {t("Prüfung als erledigt speichern", "Record completed review")} ✓
                  </button>
                )}
                {active.property.state === "REPORT_READY" &&
                  !active.property.reports.some((r) => r.tier === "FULL") && (
                    <div className="notice">
                      <strong>
                        {t(
                          "Vollständiger Bericht ausstehend",
                          "Full report pending",
                        )}
                      </strong>
                      <p>
                        {t(
                          "Das Value Signal ist verfügbar. Die Strategie wird separat erstellt und erst nach Prüfung freigegeben.",
                          "The Value Signal is available. Full strategy is generated separately and held for your review.",
                        )}
                      </p>
                      <button
                        className="button secondary"
                        disabled={busy || loading}
                        onClick={() =>
                          action("leads/" + active.id + "/retry-valuation")
                        }
                      >
                        {t(
                          "Fehlgeschlagene Erstellung wiederholen",
                          "Retry failed generation",
                        )}
                      </button>
                    </div>
                  )}
                {active.property.reports
                  .filter(
                    (r) =>
                      r.tier === "FULL" &&
                      active.property.state === "REPORT_READY",
                  )
                  .map((r) => (
                    <p key={r.id}>
                      {r.releaseState === "RELEASED" ? (
                        <span className="badge">
                          {t("Bericht freigegeben", "Full report released")}
                        </span>
                      ) : (
                        <button
                          className="button"
                          disabled={busy || loading || !active.reviewedAt || !r.reviewedAt}
                          onClick={() => action("reports/" + r.id + "/release")}
                        >
                          {t("Vollständigen Bericht freigeben", "Release full report")} →
                        </button>
                      )}
                    </p>
                  ))}
              </section>
              <section className="card">
                <p className="eyebrow">
                  {t("PRIORITÄT", "PRIORITY")} · {active.scoreVersion}
                </p>
                <h2>{active.score} / 100</h2>
                {active.scoreReasons.map((r, i) => (
                  <p key={i}>
                    <span>{r.label}</span> <strong>{`+${r.points}`}</strong>
                  </p>
                ))}
                <small>
                  {t(
                    "Die Punkte kommen aus den Angaben des Verkäufers. Die Entscheidung trifft der Makler.",
                    "Points come from the seller’s answers. The broker makes the final decision.",
                  )}
                </small>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="workspace-intro">
            <div>
              <p className="eyebrow">{t("HEUTE", "TODAY")}</p>
              <h2>{t("Jede Anfrage. Ein nächster Schritt.", "Every lead. A clear next step.")}</h2>
            </div>
            <p>
              {t(
                "Öffnen Sie eine Anfrage, um Kontakt, Notizen und den nächsten Schritt festzuhalten.",
                "Open a request to review the seller, save notes and set the next step.",
              )}
            </p>
          </div>
          <div className="stat-grid">
            {[
              [t("Passende Anfragen", "Matching leads"), total],
              [
                t("Hohe Priorität · diese Seite", "High priority · this page"),
                leads.filter((l) => l.scoreBand === "HOT").length,
              ],
              [
                t("Noch nicht kontaktiert · diese Seite", "Awaiting contact · this page"),
                leads.filter((l) => l.stage === "NEW").length,
              ],
              [
                t("Bewertung offen · diese Seite", "Valuation pending · this page"),
                leads.filter((l) => l.property.state !== "REPORT_READY").length,
              ],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(search.trim());
              setPage(1);
              setSelected(null);
              load();
            }}
          >
            <input
              aria-label={t("Anfragen durchsuchen", "Search all accessible leads")}
              maxLength={120}
              placeholder={t(
                "Name, Straße oder Ort suchen …",
                "Search seller, address or city…",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label={t("Status filtern", "Filter stage")}
              value={filter}
              onChange={(e) => {
                setLoading(true);
                setFilter(e.target.value);
                setPage(1);
                setSelected(null);
              }}
            >
              <option value="ALL">{t("Alle Status", "All stages")}</option>
              {pipelineStages.map((s) => (
                <option key={s} value={s}>
                  {humanLabel(t, "stage", s)}
                </option>
              ))}
            </select>
            <button className="button" type="submit" disabled={loading}>
              {t("Suchen", "Search")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={load}
              disabled={loading}
            >
              {t("Aktualisieren", "Refresh")} ↻
            </button>
            {(appliedSearch || filter !== "ALL") && <button type="button" className="text-link" disabled={loading} onClick={() => {
              setSearch(""); setAppliedSearch(""); setFilter("ALL"); setPage(1); load();
            }}>{t("Filter zurücksetzen", "Clear filters")}</button>}
          </form>
          {loading && (
            <p role="status">
              {t("Anfragen werden geladen …", "Loading matching leads…")}
            </p>
          )}
          {visible.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("OBJEKT / VERKÄUFER", "PROPERTY / SELLER")}</th>
                    <th>{t("DETAILS", "DETAILS")}</th>
                    <th>{t("PRIORITÄT", "PRIORITY")}</th>
                    <th>{t("STATUS", "STAGE")}</th>
                    <th>{t("EINGANG", "RECEIVED")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <button
                          className="row-link"
                          onClick={() => setSelected(l.id)}
                        >
                          {l.property.address.street}
                        </button>
                        <small>
                          {l.property.sellerContact.name} ·{" "}
                          {l.property.address.city}
                        </small>
                      </td>
                      <td>
                        <span>{`${l.property.sizeSqm} m²`}</span>
                        <small>{humanLabel(t, "type", l.property.propertyType)}</small>
                      </td>
                      <td>
                        <span className={"badge " + l.scoreBand}>
                          {`${humanLabel(t, "band", l.scoreBand)} · ${l.score}`}
                        </span>
                      </td>
                      <td>
                        <span className="stage-pill">
                          {humanLabel(t, "stage", l.stage)}
                        </span>
                        <small>
                          {l.assignedToId
                            ? t("Zugewiesen", "Assigned")
                            : t("Zuweisung offen", "Needs assignment")}
                        </small>
                      </td>
                      <td>
                        {new Date(l.createdAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !loading && !error ? (
            <div className="empty-state">
              <h2>
                {appliedSearch || filter !== "ALL"
                  ? t("Keine passende Anfrage.", "No matching leads.")
                  : t("Hier erscheinen neue Anfragen.", "Your next conversation starts here.")}
              </h2>
              <p>
                {appliedSearch || filter !== "ALL"
                  ? t(
                      "Andere Suche oder einen anderen Status versuchen.",
                      "Try another search or stage.",
                    )
                  : t(
                      "Neue Einschätzungen erscheinen hier, sobald sie Ihnen zugewiesen sind.",
                      "New seller assessments appear here once they are assigned to you.",
                    )}
              </p>
              <Link href="/valuation/start" className="text-link">
                {t("Verkäuferformular öffnen", "Open seller assessment")} →
              </Link>
            </div>
          ) : null}
          <div className="pagination">
            <small>
              {t(`Seite ${page} · ${total} Anfragen`, `Page ${page} · ${total} leads`)}
            </small>
            <button
              className="button secondary"
              aria-label={t("Vorherige Seite", "Previous page")}
              disabled={loading || page === 1}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              ←
            </button>
            <button
              className="button secondary"
              aria-label={t("Nächste Seite", "Next page")}
              disabled={loading || page * 50 >= total}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              →
            </button>
          </div>
        </>
      )}
    </main>
  );
}
