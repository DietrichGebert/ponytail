"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "./locale-provider";
import Link from "next/link";
export default function NewsletterAction({
  action,
}: {
  action: "confirm" | "unsubscribe";
}) {
  const { t } = useLocale();
  const [state, setState] = useState("idle");
  async function perform() {
    setState("busy");
    // Fragment tokens are not sent in page requests or Referer headers.
    const token =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ||
      new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      return;
    }
    try {
      if (action === "confirm")
        await api("newsletter/confirm?token=" + encodeURIComponent(token));
      else
        await api("newsletter/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
      setState("done");
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      setState("error");
    }
  }
  return (
    <main id="main" className="newsletter-page card">
      <p className="eyebrow">VISION ESTATES · NEWSLETTER</p>
      <h1>
        {state === "done"
          ? action === "confirm"
            ? t("Abonnement bestätigt.", "Subscription confirmed.")
            : t("Sie sind abgemeldet.", "You are unsubscribed.")
          : action === "confirm"
            ? t("Ihre Entscheidung zählt.", "It’s your choice.")
            : t("Newsletter abbestellen", "Unsubscribe from the newsletter")}
      </h1>
      <p>
        {state === "done"
          ? action === "confirm"
            ? t(
                "Ihre E-Mail-Adresse ist jetzt für den Newsletter bestätigt. Sie können sich jederzeit über den Link in einer Newsletter-E-Mail abmelden.",
                "Your email address is now confirmed for the newsletter. You can unsubscribe at any time using the link in a newsletter email.",
              )
            : t(
                "Sie erhalten keine weiteren Newsletter. Ihre Immobilieneinschätzung bleibt davon unberührt.",
                "You will receive no further newsletters. Your property assessment is unaffected.",
              )
          : action === "confirm"
            ? t(
                "Bestätigen Sie Ihr freiwilliges Newsletter-Abonnement. Ihre Immobilieneinschätzung ist davon unabhängig.",
                "Confirm your voluntary newsletter subscription. Your property assessment is independent of this choice.",
              )
            : t(
                "Ein Klick genügt. Eine Anmeldung ist nicht erforderlich.",
                "One click is all it takes. No sign-in is required.",
              )}
      </p>
      {state === "error" && (
        <div role="alert" className="error">
          {t(
            "Der Link ist ungültig, abgelaufen oder wurde bereits verwendet. Bitte verwenden Sie den neuesten Link aus Ihrer E-Mail.",
            "This link is invalid, expired or already used. Please use the latest link in your email.",
          )}
        </div>
      )}
      {state !== "done" ? (
        <button
          className="button"
          disabled={state === "busy"}
          onClick={perform}
        >
          {state === "busy"
            ? t("Wird verarbeitet …", "Processing …")
            : action === "confirm"
              ? t("Abonnement bestätigen", "Confirm subscription")
              : t("Jetzt abmelden", "Unsubscribe now")}
        </button>
      ) : (
        <Link className="button secondary" href="/">
          {t("Zur Startseite", "Back to home")} →
        </Link>
      )}
    </main>
  );
}
