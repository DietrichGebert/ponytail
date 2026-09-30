"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { useLocale } from "@/components/locale-provider";
export default function Login() {
  const { t } = useLocale();
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      router.push("/broker/leads");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <main id="main">
      <div className="login-card">
        <p className="eyebrow">
          VISION ESTATES · {t("MAKLERPORTAL", "BROKER PORTAL")}
        </p>
        <h1>{t("Willkommen zurück.", "Welcome back.")}</h1>
        <p className="subtitle">
          {t(
            "Melden Sie sich in Ihrem Maklerbereich an.",
            "Sign in to your property pipeline.",
          )}
        </p>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <label className="field">
            {t("Geschäftliche E-Mail", "Work email")}
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label className="field">
            {t("Passwort", "Password")}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          <button className="button" disabled={busy}>
            {busy
              ? t("Anmeldung läuft …", "Signing in…")
              : t("Anmelden →", "Sign in →")}
          </button>
        </form>
        <p>
          <Link href="/broker/signup">
            {t(
              "Einladung erhalten? Zugang einrichten",
              "Invited to the team? Set up your account",
            )}
          </Link>
        </p>
        <p style={{ marginTop: 24 }}>
          <small>
            {t(
              "Den Zugang erhalten Sie von Ihrer Administration. Wenden Sie sich bei Zugangsproblemen an Ihr Team.",
              "Access is provided by your administrator. Contact your team if you need help signing in.",
            )}
          </small>
        </p>
      </div>
    </main>
  );
}
