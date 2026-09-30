"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
export type Locale = "de-DE" | "en";
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (value: Locale) => void;
  t: (de: string, en: string) => string;
}>({ locale: "de-DE", setLocale: () => {}, t: (de) => de });
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, update] = useState(initialLocale);
  function setLocale(value: Locale) {
    update(value);
    document.cookie = `ve-locale=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = value;
  }
  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        t: (de, en) => (locale === "de-DE" ? de : en),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
export const useLocale = () => useContext(LocaleContext);
export function SkipLink() {
  const { t } = useLocale();
  return (
    <a className="skip-link" href="#main">
      {t("Zum Inhalt springen", "Skip to content")}
    </a>
  );
}
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="locale-switch" role="group" aria-label="Sprache / Language">
      <button
        type="button"
        aria-pressed={locale === "de-DE"}
        onClick={() => setLocale("de-DE")}
      >
        DE
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
