import type { Metadata } from "next";
import "./globals.css";
import "./blueprint.css";
import { SiteHeader, Footer } from "@/components/site-header";
import { cookies } from "next/headers";
import { LocaleProvider, SkipLink } from "@/components/locale-provider";
export const metadata: Metadata = {
  title: {
    default: "Vision Estates | Immobilien klar einschätzen",
    template: "%s | Vision Estates",
  },
  description:
    "Eine klare Einschätzung Ihrer Immobilie und ein persönliches Gespräch über den nächsten Schritt.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale =
    (await cookies()).get("ve-locale")?.value === "en" ? "en" : "de-DE";
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <SkipLink />
          <SiteHeader />
          {children}
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
