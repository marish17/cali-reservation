"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import StatusBadge from "@/components/StatusBadge";
import { ageAt, formatDayLong, formatTime, toISODate } from "@/lib/date";

type Row = {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  full_name: string;
  birth_date: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  email: string;
  phone: string;
  notes: string | null;
  status: string;
  decision_note: string | null;
  created_at: string;
  coaches: { name: string } | null;
};

type Filter = "pending" | "upcoming" | "all";

const FILTERS: [Filter, string][] = [
  ["pending", "Da approvare"],
  ["upcoming", "Confermate in arrivo"],
  ["all", "Tutte"],
];

export default function AdminBookingsPage() {
  const { session } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const today = toISODate(new Date());

    let query = supabase
      .from("bookings")
      .select(
        "id, day, start_time, end_time, full_name, birth_date, guardian_name, guardian_phone, email, phone, notes, status, decision_note, created_at, coaches(name)"
      )
      .order("day", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(300);

    if (filter === "pending") query = query.eq("status", "pending").gte("day", today);
    if (filter === "upcoming") query = query.eq("status", "approved").gte("day", today);

    const { data, error } = await query;
    if (error) setError("Errore nel caricamento delle prenotazioni.");
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(row: Row, status: "approved" | "rejected") {
    if (!session) return;
    const label = status === "approved" ? "Confermare" : "Rifiutare";
    if (!confirm(`${label} la prova di ${row.full_name}? Gli arriverà una email.`)) return;

    setBusyId(row.id);
    setError(null);
    setEmailWarning(null);

    const response = await fetch("/api/decide", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ booking_id: row.id, status, note: notes[row.id] ?? null }),
    }).catch(() => null);

    setBusyId(null);

    if (!response || !response.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Operazione non riuscita.");
      return;
    }

    const body = (await response.json().catch(() => null)) as
      | { email?: { ok: boolean; reason?: string } }
      | null;

    if (body?.email && !body.email.ok) {
      setEmailWarning(
        `Decisione registrata, ma l'email a ${row.full_name} non è partita` +
          `${body.email.reason ? ` (${body.email.reason})` : ""}. ` +
          `Avvisalo tu: ${row.email}`
      );
    }

    setNotes((current) => ({ ...current, [row.id]: "" }));
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              "rounded-xl border px-3 py-1.5 text-xs transition",
              filter === value
                ? "border-accent bg-accent/10 text-accentSoft"
                : "border-line text-slate-300 hover:border-slate-500",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
        <span className="badge ml-auto">{rows.length}</span>
      </div>

      {error && <p className="card border-red-500/40 text-sm text-red-200">{error}</p>}

      {emailWarning && (
        <div className="card border-accent/45 bg-accent/[0.07]">
          <p className="text-sm text-slate-200">{emailWarning}</p>
          <button
            className="btn-ghost mt-3 !px-3 !py-1.5 text-xs"
            onClick={() => setEmailWarning(null)}
          >
            Ho capito
          </button>
        </div>
      )}

      {loading && <p className="card text-sm text-slate-400">Caricamento…</p>}

      {!loading && rows.length === 0 && (
        <p className="card text-sm text-slate-400">
          {filter === "pending"
            ? "Nessuna richiesta in attesa. Tutto smaltito."
            : "Nessuna prenotazione in questo elenco."}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className={["card", row.status === "cancelled" ? "opacity-50" : ""].join(" ")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {row.full_name}
                  {row.birth_date && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {ageAt(row.birth_date, row.day)} anni
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDayLong(row.day)} · {formatTime(row.start_time)}–{formatTime(row.end_time)}
                  {row.coaches ? ` · ${row.coaches.name}` : ""}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
              <a className="hover:text-slate-200" href={`mailto:${row.email}`}>
                {row.email}
              </a>
              <a className="hover:text-slate-200" href={`tel:${row.phone}`}>
                {row.phone}
              </a>
            </div>

            {row.guardian_name && (
              <p className="mt-3 rounded-lg border border-accent/45 bg-accent/[0.07] p-3 text-xs text-slate-200">
                Minore accompagnato da {row.guardian_name}
                {row.guardian_phone ? ` · ${row.guardian_phone}` : ""}
              </p>
            )}

            {row.notes && (
              <p className="mt-3 rounded-lg border border-line bg-ink/50 p-3 text-xs text-slate-300">
                {row.notes}
              </p>
            )}

            {row.decision_note && row.status !== "pending" && (
              <p className="mt-3 text-xs text-slate-500">
                Messaggio inviato: {row.decision_note}
              </p>
            )}

            {row.status === "pending" && (
              <div className="mt-4 border-t border-line pt-4">
                <label className="label" htmlFor={`note-${row.id}`}>
                  Messaggio per la persona (facoltativo)
                </label>
                <input
                  id={`note-${row.id}`}
                  className="field"
                  placeholder="Es. Ci vediamo alle 18, porta scarpe da ginnastica"
                  value={notes[row.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-primary !px-4 !py-2 text-xs"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row, "approved")}
                  >
                    {busyId === row.id ? "Attendi…" : "Conferma la prova"}
                  </button>
                  <button
                    className="btn-ghost !px-4 !py-2 text-xs"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row, "rejected")}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
