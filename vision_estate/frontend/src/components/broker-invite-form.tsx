"use client";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { useLocale } from "./locale-provider";
export function BrokerInviteForm({
  onCreated,
}: {
  onCreated: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("admin/broker-invitations", {
        method: "POST",
        body: JSON.stringify({
          name: values.get("name"),
          email: values.get("email"),
          locale,
        }),
      });
      form.reset();
      setMessage(
        t(
          "Einladung erstellt und zur E-Mail-Zustellung vorgemerkt. Zugang wird erst nach Bestätigung aktiviert.",
          "Invitation created and queued for email delivery. Access activates after the broker verifies the link.",
        ),
      );
      await onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <p className="eyebrow">
        {t("SICHERER TEAMZUGANG", "VERIFIED TEAM ACCESS")}
      </p>
      <h2>{t("Makler einladen", "Invite a broker")}</h2>
      <p>
        {t(
          "Ihr Teammitglied bestätigt seine E-Mail-Adresse und legt ein eigenes Passwort fest.",
          "Your team member verifies their email and chooses their own password.",
        )}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <form onSubmit={invite}>
        <label className="field">
          Name
          <input name="name" required maxLength={120} />
        </label>
        <label className="field">
          {t("Geschäftliche E-Mail", "Work email")}
          <input name="email" type="email" required maxLength={254} />
        </label>
        <button className="button" disabled={busy}>
          {busy
            ? t("Wird erstellt …", "Creating…")
            : t("Einladung erstellen →", "Create invitation →")}
        </button>
      </form>
    </section>
  );
}
