"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDayLong, formatTime, toISODate } from "@/lib/date";

type Row = {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  full_name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: "confirmed" | "cancelled";
  created_at: string;
  coaches: { name: string } | null;
};

type Filter = "upcoming" | "past" | "all";

export default function AdminBookingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const today = toISODate(new Date());

    let query = supabase
      .from("bookings")
      .select("id, day, start_time, end_time, full_name, email, phone, notes, status, created_at, coaches(name)")
      .order("day", { ascending: filter !== "past" })
      .order("start_time", { ascending: true })
      .limit(300);

    if (filter === "upcoming") query = query.gte("day", today);
    if (filter === "past") query = query.lt("day", today);

    const { data, error } = await query;
    if (error) setError("Errore nel caricamento delle prenotazioni.");
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Annullare questa prenotazione? Il posto tornerà disponibile.")) return;
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setError("Non è stato possibile annullare la prenotazione.");
    else void load();
  }

  const confirmed = rows.filter((r) => r.status === "confirmed");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["upcoming", "In arrivo"],
            ["past", "Passate"],
            ["all", "Tutte"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              "rounded-xl border px-3 py-1.5 text-xs transition",
              filter === value
                ? "border-accent bg-accent/10 text-accent"
                : "border-line text-slate-300 hover:border-slate-500",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
        <span className="badge ml-auto">{confirmed.length} confermate</span>
      </div>

      {error && <p className="card border-red-500/40 text-sm text-red-200">{error}</p>}
      {loading && <p className="card text-sm text-slate-400">Caricamento…</p>}

      {!loading && rows.length === 0 && (
        <p className="card text-sm text-slate-400">Nessuna prenotazione in questo periodo.</p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className={[
              "card",
              row.status === "cancelled" ? "opacity-50" : "",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{row.full_name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDayLong(row.day)} · {formatTime(row.start_time)}–{formatTime(row.end_time)}
                  {row.coaches ? ` · ${row.coaches.name}` : ""}
                </p>
              </div>
              {row.status === "confirmed" ? (
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void cancel(row.id)}>
                  Annulla
                </button>
              ) : (
                <span className="badge">annullata</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
              <a className="hover:text-slate-200" href={`mailto:${row.email}`}>
                {row.email}
              </a>
              <a className="hover:text-slate-200" href={`tel:${row.phone}`}>
                {row.phone}
              </a>
            </div>

            {row.notes && (
              <p className="mt-3 rounded-lg border border-line bg-ink/50 p-3 text-xs text-slate-300">
                {row.notes}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
