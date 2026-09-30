"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage, type Identity } from "@/lib/api";
import { useLocale } from "./locale-provider";

type Broker = Identity & { active: boolean; email: string };

export function AssignLead({ leadId, assignedToId, onAssigned }: {
  leadId: string;
  assignedToId: string | null;
  onAssigned: () => void;
}) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selected, setSelected] = useState(assignedToId || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const savingRef = useRef(false);
  const { t } = useLocale();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const all: Broker[] = [];
        let cursor: string | null = null;
        do {
          const query = new URLSearchParams({ limit: "100" });
          if (cursor) query.set("cursor", cursor);
          const result: { data: Broker[]; nextCursor: string | null } = await api(
            `admin/users?${query}`, { signal: controller.signal },
          );
          all.push(...result.data);
          cursor = result.nextCursor;
        } while (cursor && !controller.signal.aborted);
        if (!controller.signal.aborted) {
          setBrokers(all.filter((u) => u.active && u.role === "BROKER")
            .sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  const eligible = brokers.some((broker) => broker.id === selected);
  const current = brokers.find((broker) => broker.id === assignedToId);
  return (
    <section className="card assignment-card">
      <p className="eyebrow">{t("ZUSTÄNDIGKEIT", "OWNERSHIP")}</p>
      <h3>{t("Makler zuweisen", "Assign a broker")}</h3>
      <p className="assignment-current">{current
        ? t(`Aktuell bei ${current.name}`, `Currently assigned to ${current.name}`)
        : assignedToId ? t("Das zugewiesene Konto ist inaktiv. Wählen Sie einen aktiven Makler.", "Assigned account is unavailable or inactive. Choose an active broker.") : t("Noch niemand zuständig. Wählen Sie, wer sich meldet.", "Unassigned · choose who follows up.")}</p>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!eligible || savingRef.current || loading) return;
        savingRef.current = true;
        setSaving(true);
        setError("");
        setMessage("");
        try {
          await api(`admin/leads/${leadId}/assign`, {
            method: "POST", body: JSON.stringify({ brokerId: selected }),
          });
          setMessage(t("Zuweisung gespeichert. Der Makler sieht die Anfrage jetzt.", "Assignment saved. The broker can now access this lead."));
          onAssigned();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      }}>
        <label className="field">
          <span>{t("Zuständiger Makler", "Responsible broker")}</span>
          <select aria-label={t("Makler zuweisen", "Assign broker")} value={eligible ? selected : ""}
            disabled={loading || saving || !brokers.length}
            onChange={(event) => { setSelected(event.target.value); setMessage(""); setError(""); }}>
            <option value="">{loading ? t("Makler werden geladen …", "Loading brokers…") : t("Aktiven Makler wählen", "Select an active broker")}</option>
            {brokers.map((broker) => <option key={broker.id} value={broker.id}>{`${broker.name} · ${broker.email}`}</option>)}
          </select>
        </label>
        <button className="button" disabled={loading || saving || !eligible || selected === assignedToId}>
          {saving ? t("Wird gespeichert …", "Saving assignment…") : t("Zuweisung speichern", "Save assignment") + " →"}
        </button>
      </form>
      {!loading && !error && !brokers.length && <p>{t("Kein aktiver Makler. Laden Sie zuerst jemanden ein und warten Sie auf die Bestätigung.", "No active brokers available. Invite a broker and complete account verification first.")} <Link href="/admin">{t("Team verwalten", "Manage team")} →</Link></p>}
      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status" className="notice">{message}</p>}
      <button type="button" className="text-link" disabled={loading || saving} onClick={() => {
        setLoading(true); setError(""); setRevision((value) => value + 1);
      }}>{t("Maklerliste aktualisieren", "Refresh broker list")} ↻</button>
    </section>
  );
}
