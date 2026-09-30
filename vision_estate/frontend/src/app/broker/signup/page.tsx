"use client";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { useLocale } from "@/components/locale-provider";
const readToken = () =>
  new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
const subscribeToken = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};
export default function BrokerSignup() {
  const { t } = useLocale();
  const token = useSyncExternalStore(subscribeToken, readToken, () => "");
  const [inspection, setInspection] = useState<{
    token: string;
    details?: { name: string; email: string };
    error?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [submitError, setError] = useState("");
  const details = inspection?.token === token ? inspection.details : null;
  const error =
    submitError || (inspection?.token === token ? inspection.error : "");
  const loading = !!token && inspection?.token !== token && !done;
  useEffect(() => {
    if (!token) return;
    let live = true;
    api<{ name: string; email: string }>("auth/invitation/inspect", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((v) => {
        if (live) setInspection({ token, details: v });
      })
      .catch((e) => {
        if (live) setInspection({ token, error: errorMessage(e) });
      });
    return () => {
      live = false;
    };
  }, [token]);
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (values.get("password") !== values.get("confirm")) {
      setError(
        t("Die Passwörter stimmen nicht überein.", "Passwords do not match."),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("auth/invitation/accept", {
        method: "POST",
        body: JSON.stringify({ token, password: values.get("password") }),
      });
      history.replaceState(null, "", window.location.pathname);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main">
      <section className="login-card">
        <p className="eyebrow">
          VISION ESTATES · {t("MAKLERZUGANG", "BROKER ACCESS")}
        </p>
        <h1>
          {done
            ? t("Ihr Zugang ist bereit.", "Your account is ready.")
            : t("Willkommen im Team.", "Welcome to the team.")}
        </h1>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">
            {t("Einladung wird geprüft …", "Checking your invitation…")}
          </p>
        ) : done ? (
          <>
            <p role="status">
              {t(
                "Ihre E-Mail-Adresse ist bestätigt. Melden Sie sich mit Ihrem neuen Passwort an.",
                "Your email is verified. Sign in with your new password.",
              )}
            </p>
            <Link className="button" href="/broker/login">
              {t("Zur Anmeldung →", "Go to sign in →")}
            </Link>
          </>
        ) : details ? (
          <>
            <p>
              {details.name} · {details.email}
            </p>
            <p>
              {t(
                "Bestätigen Sie Ihre E-Mail-Adresse und erstellen Sie Ihr persönliches Passwort.",
                "Verify your email and create your personal password.",
              )}
            </p>
            <form onSubmit={accept}>
              <label className="field">
                {t(
                  "Neues Passwort (mindestens 12 Zeichen)",
                  "New password (at least 12 characters)",
                )}
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <label className="field">
                {t("Passwort wiederholen", "Confirm password")}
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                {busy
                  ? t("Wird bestätigt …", "Verifying…")
                  : t(
                      "E-Mail bestätigen und Zugang aktivieren →",
                      "Verify email and activate account →",
                    )}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              {t(
                "Für den Maklerzugang benötigen Sie eine Einladung Ihrer Administration. Öffnen Sie den persönlichen Link aus Ihrer E-Mail.",
                "Broker registration requires an invitation from your administrator. Open the personal link in your invitation email.",
              )}
            </p>
            <Link href="/broker/login">
              {t(
                "Bereits registriert? Anmelden",
                "Already registered? Sign in",
              )}
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
