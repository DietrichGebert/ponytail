"use client";
import Link from "next/link";
import { useLocale } from "./locale-provider";

export function WorkspaceNav({
  role,
  active,
  onLeads,
}: {
  role?: string;
  active: "leads" | "bookings" | "admin";
  onLeads?: () => void;
}) {
  const { t } = useLocale();
  return (
    <nav className="portal-tabs" aria-label={t("Arbeitsbereich", "Workspace")}>
      <Link
        href="/broker/leads"
        className={active === "leads" ? "active" : ""}
        onClick={onLeads}
      >
        {t("Anfragen", "Leads")}
      </Link>
      <Link
        href="/broker/bookings"
        className={active === "bookings" ? "active" : ""}
      >
        {t("Termine", "Appointments")}
      </Link>
      {role === "ADMIN" && (
        <Link href="/admin" className={active === "admin" ? "active" : ""}>
          {t("Verwaltung", "Administration")}
        </Link>
      )}
    </nav>
  );
}
