"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StatusBadge from "@/components/StatusBadge";
import { bookingErrorMessage } from "@/lib/errors";
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
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

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

  async function decide(row: Row, status: "approved" | "rejected" | "cancelled") {
    const label =
      status === "approved"
        ? `Confermare la prova di ${row.full_name}?`
        : status === "rejected"
          ? `Rifiutare la richiesta di ${row.full_name}?`
          : `Annullare la prova di ${row.full_name}? Il posto tornerà libero.`;
    if (!confirm(label)) return;

    setBusyId(row.id);
    setError(null);
    setNotice(null);

    const { error } = await supabase.rpc("decide_booking", {
      p_booking_id: row.id,
      p_status: status,
      p_note: notes[row.id] || null,
    });

    setBusyId(null);

    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }

    // Nessuna email in giro: la persona lo scopre rientrando nell'app.
    // Se la prova è imminente, un colpo di telefono è più sicuro.
    setNotice(
      status === "cancelled"
        ? `Prova annullata. ${row.full_name} lo vedrà rientrando nell'app; se è a ridosso, avvisalo al ${row.phone}.`
        : null
    );

    setNotes((current) => ({ ...current, [row.id]: "" }));
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              "min-h-[38px] shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-xs transition active:scale-[0.98]",
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

      {notice && (
        <div className="card border-accent/45 bg-accent/[0.07]">
          <p className="text-sm text-slate-200">{notice}</p>
          <button
            className="btn-ghost mt-3 !px-3 !py-1.5 text-xs"
            onClick={() => setNotice(null)}
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
                <p className="mt-0.5 text-xs first-letter:uppercase text-slate-400">
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

            {(row.status === "pending" || row.status === "approved") && (
              <div className="mt-4 border-t border-line pt-4">
                <label className="label" htmlFor={`note-${row.id}`}>
                  {row.status === "pending"
                    ? "Messaggio per la persona (facoltativo)"
                    : "Motivo dell'annullamento (facoltativo)"}
                </label>
                <input
                  id={`note-${row.id}`}
                  className="field"
                  placeholder={
                    row.status === "pending"
                      ? "Es. Ci vediamo alle 18, porta scarpe da ginnastica"
                      : "Es. Imprevisto del coach, ti ricontattiamo"
                  }
                  value={notes[row.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                />
                <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                  {row.status === "pending" ? (
                    <>
                      <button
                        className="btn-primary text-sm"
                        disabled={busyId === row.id}
                        onClick={() => void decide(row, "approved")}
                      >
                        {busyId === row.id ? "Attendi…" : "Conferma la prova"}
                      </button>
                      <button
                        className="btn-ghost text-sm"
                        disabled={busyId === row.id}
                        onClick={() => void decide(row, "rejected")}
                      >
                        Rifiuta
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-ghost text-sm"
                      disabled={busyId === row.id}
                      onClick={() => void decide(row, "cancelled")}
                    >
                      {busyId === row.id ? "Attendi…" : "Annulla la prova"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
