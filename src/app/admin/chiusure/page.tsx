"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDayLong, toISODate } from "@/lib/date";
import type { Closure } from "@/lib/types";

export default function AdminClosuresPage() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [day, setDay] = useState(toISODate(new Date()));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("closures")
      .select("*")
      .gte("day", toISODate(new Date()))
      .order("day");
    if (error) setError("Errore nel caricamento delle chiusure.");
    else setClosures((data as Closure[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const { error } = await supabase
      .from("closures")
      .insert({ day, reason: reason.trim() || null });
    if (error) setError("Questa data è già registrata come chiusura.");
    else {
      setReason("");
      void load();
    }
  }

  async function remove(id: string) {
    await supabase.from("closures").delete().eq("id", id);
    void load();
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-base font-semibold">Aggiungi una chiusura</h2>
        <p className="mt-1 text-sm text-slate-400">
          Nei giorni di chiusura nessuna fascia viene mostrata e le prenotazioni sono bloccate.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={add}>
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              className="field !w-auto"
              value={day}
              min={toISODate(new Date())}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Motivo (facoltativo)</label>
            <input
              className="field"
              placeholder="Festività, manutenzione…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit">
            Aggiungi
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
      </section>

      <section className="card">
        <h2 className="text-base font-semibold">Chiusure programmate</h2>
        {loading && <p className="mt-3 text-sm text-slate-400">Caricamento…</p>}
        {!loading && closures.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">Nessuna chiusura programmata.</p>
        )}
        <ul className="mt-3 space-y-2">
          {closures.map((closure) => (
            <li
              key={closure.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink/40 px-3 py-2 text-sm"
            >
              <span className="font-medium">{formatDayLong(closure.day)}</span>
              {closure.reason && <span className="text-slate-400">{closure.reason}</span>}
              <button
                className="btn-ghost ml-auto !px-2.5 !py-1 text-xs"
                onClick={() => void remove(closure.id)}
              >
                Rimuovi
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
