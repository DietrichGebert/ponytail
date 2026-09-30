"use client";
import type { components } from "@/lib/generated/api-types";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, errorMessage } from "@/lib/api";
import { BrokerInviteForm } from "@/components/broker-invite-form";
import { WorkspaceNav } from "@/components/workspace-nav";
import { useLocale } from "@/components/locale-provider";
type Overview = components["schemas"]["AdminOverview"];
export default function Admin() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api<Overview>("admin/overview"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.replace("/broker/login");
      else setError(errorMessage(e));
    }
  }, [router]);
  useEffect(() => {
    let live = true;
    api<Overview>("admin/overview")
      .then((result) => {
        if (live) setData(result);
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
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("admin/users", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(f)),
      });
      form.reset();
      await load();
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
            {t("VISION ESTATES · VERWALTUNG", "VISION ESTATES · ADMINISTRATION")}
          </p>
          <h1>{t("Team und Betrieb im Blick.", "A clear view of your operations.")}</h1>
          <p className="subtitle">
            {t(
              "Laden Sie Makler ein, prüfen Sie den Status der Dienste und sehen Sie, was noch offen ist.",
              "Invite brokers, check service status and see what is still open.",
            )}
          </p>
        </div>
      </div>
      <WorkspaceNav role="ADMIN" active="admin" />
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="stat-grid">
            {Object.entries(data.integrations).map(([name, ready]) => (
              <div className="stat" key={name}>
                <small>{name.toUpperCase()}</small>
                <strong style={{ fontSize: 19 }}>
                  {ready ? t("Eingerichtet", "Configured") : t("Noch nicht eingerichtet", "Not configured")}
                </strong>
              </div>
            ))}
          </div>
          <div className="detail-grid">
            <div>
              <section className="card">
                <h2>{t("Ihr Team.", "Your team.")}</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("PERSON", "TEAM MEMBER")}</th>
                        <th>{t("ROLLE", "ROLE")}</th>
                        <th>{t("ZUGANG", "ACCESS")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            {u.name}
                            <small>{u.email}</small>
                          </td>
                          <td>{u.role}</td>
                          <td>
                            {u.invitation && !u.invitation.acceptedAt ? (
                              <>
                                <small>
                                  {u.invitation.revokedAt
                                    ? t("Einladung zurückgezogen", "Invitation revoked")
                                    : t("Wartet auf E-Mail-Bestätigung", "Awaiting email verification")}
                                </small>
                                <button
                                  className="row-link"
                                  disabled={busy}
                                  onClick={async () => {
                                    setBusy(true);
                                    setError("");
                                    try {
                                      await api(
                                        "admin/broker-invitations/" +
                                          u.invitation!.id +
                                          "/resend",
                                        { method: "POST" },
                                      );
                                      await load();
                                    } catch (e) {
                                      setError(errorMessage(e));
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                >
                                  {t("Einladung erneut senden", "Reissue invitation")}
                                </button>
                                {!u.invitation.revokedAt && (
                                  <button
                                    className="row-link"
                                    disabled={busy}
                                    onClick={async () => {
                                      setBusy(true);
                                      setError("");
                                      try {
                                        await api(
                                          "admin/broker-invitations/" +
                                            u.invitation!.id,
                                          { method: "DELETE" },
                                        );
                                        await load();
                                      } catch (e) {
                                        setError(errorMessage(e));
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                  >
                                    {t("Einladung zurückziehen", "Revoke invitation")}
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                className="row-link"
                                onClick={async () => {
                                  try {
                                    await api("admin/users/" + u.id, {
                                      method: "PATCH",
                                      body: JSON.stringify({
                                        active: !u.active,
                                      }),
                                    });
                                    await load();
                                  } catch (e) {
                                    setError(errorMessage(e));
                                  }
                                }}
                              >
                                {u.active ? t("Deaktivieren", "Deactivate") : t("Wieder aktivieren", "Reactivate")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="card">
                <h2>{t("Letzte Aktivitäten.", "Recent activity.")}</h2>
                {data.audit.map((a) => (
                  <p key={a.id}>
                    <small>
                      {new Date(a.timestamp).toLocaleString(locale)}
                    </small>
                    <br />
                    {a.action.replaceAll("_", " ")} <small>· {a.actorId}</small>
                  </p>
                ))}
              </section>
            </div>
            <aside>
              <BrokerInviteForm onCreated={load} />
              <section className="card">
                <h2>{t("Konto direkt anlegen.", "Add a team member.")}</h2>
                <form onSubmit={create}>
                  <label className="field">
                    Name
                    <input name="name" required maxLength={120} />
                  </label>
                  <label className="field">
                    {t("Geschäftliche E-Mail", "Work email")}
                    <input name="email" type="email" required />
                  </label>
                  <label className="field">
                    {t("Erstes Passwort", "Initial password")}
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="field">
                    {t("Rolle", "Role")}
                    <select name="role">
                      <option value="BROKER">{t("Makler", "Broker")}</option>
                      <option value="ADMIN">{t("Administration", "Administrator")}</option>
                    </select>
                  </label>
                  <button className="button" disabled={busy}>
                    {t("Konto anlegen", "Create account")} →
                  </button>
                </form>
              </section>
              <section className="card">
                <h3>{t("Priorität", "Lead scoring")} · {data.scoring.version}</h3>
                <p>{data.scoring.rules}</p>
                <small>
                  {t(
                    "Regeländerungen brauchen eine geprüfte Freigabe. Hier können sie nur gelesen werden.",
                    "Rule changes are versioned and need a reviewed release. This view is read-only.",
                  )}
                </small>
              </section>
              <section className="card">
                <h3>{t("Nachrichtenwarteschlange", "Delivery queue")}</h3>
                {data.notifications.length ? (
                  data.notifications.map((n) => (
                    <p key={n.state}>
                      {n.state}: {n._count}
                    </p>
                  ))
                ) : (
                  <p>{t("Keine wartenden Nachrichten.", "No queued notifications.")}</p>
                )}
                <p>
                  {t(
                    `${data.pending} Einschätzungen warten auf die Bewertung.`,
                    `${data.pending} assessments awaiting valuation.`,
                  )}
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
