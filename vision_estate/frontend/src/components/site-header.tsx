"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LanguageSwitch, useLocale } from "./locale-provider";
export function SiteHeader() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="site-header">
      <Link
        href="/"
        className="brand"
        aria-label={t("Vision Estates Startseite", "Vision Estates home")}
        onClick={() => setOpen(false)}
      >
        <span className="brand-mark">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m3 5 9 15L21 5M8 5l4 7 4-7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          vision<span className="brand-light">estates</span>
          <small>{t("IMMOBILIE. KLARHEIT.", "PROPERTY. CLARITY.")}</small>
        </span>
      </Link>
      <nav
        aria-label={t("Hauptnavigation", "Main navigation")}
        className={open ? "mobile-open" : ""}
      >
        <Link href="/#method" onClick={() => setOpen(false)}>
          {t("Ihr Weg", "The process")}
        </Link>
        <Link href="/#vision" onClick={() => setOpen(false)}>
          {t("Unser Ansatz", "Our approach")}
        </Link>
        <Link
          href="/broker/leads"
          className={path.startsWith("/broker") ? "nav-active" : ""}
          onClick={() => setOpen(false)}
        >
          {t("Maklerbereich", "Broker workspace")} ↗
        </Link>
      </nav>
      <div className="header-actions">
        <LanguageSwitch />
        <Link
          href="/valuation/start"
          className="button header-cta"
          onClick={() => setOpen(false)}
        >
          {t("Immobilie einschätzen", "Assess my property")} <span>↗</span>
        </Link>
        <button
          className="menu-toggle"
          aria-label={
            open
              ? t("Menü schließen", "Close navigation")
              : t("Menü öffnen", "Open navigation")
          }
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
export function Footer() {
  const { t } = useLocale();
  return (
    <footer className="site-footer">
      <Link href="/" className="footer-brand">
        vision<span>estates</span>
        <small>
          {t(
            "IHR NÄCHSTES KAPITEL BEGINNT HIER.",
            "YOUR NEXT CHAPTER STARTS HERE.",
          )}
        </small>
      </Link>
      <div>
        <Link href="/valuation/start">
          {t("Immobilieneinschätzung", "Property assessment")} ↗
        </Link>
        <Link href="/broker/login">
          {t("Makler-Anmeldung", "Broker sign in")} ↗
        </Link>
      </div>
      <p>
        {t("Deutschland", "Germany")}
        <br />
        <span>
          {t(
            "Fundierte Einordnung. Persönliche Beratung.",
            "Property intelligence. Personal perspective.",
          )}
        </span>
      </p>
    </footer>
  );
}
