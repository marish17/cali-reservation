"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import SignIn from "@/components/SignIn";
import StatusBadge from "@/components/StatusBadge";
import { bookingErrorMessage } from "@/lib/errors";
import { formatDayLong, formatTime, toISODate } from "@/lib/date";

type Row = {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  status: string;
  decision_note: string | null;
  decided_at: string | null;
  notes: string | null;
};

export default function MyBookings() {
  const { session, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, day, start_time, end_time, status, decision_note, decided_at, notes")
      .order("day", { ascending: false });
    if (error) setError("Non riusciamo a caricare le tue richieste.");
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Annullare questa richiesta?")) return;
    const { error } = await supabase.rpc("cancel_my_booking", { p_booking_id: id });
    if (error) setError(bookingErrorMessage(error));
    else void load();
  }

  if (sessionLoading) return <p className="card text-sm text-slate-400">Un attimo…</p>;

  if (!session) {
    return (
      <div className="card">
        <SignIn
          title="Accedi per vedere le tue richieste"
          description="Ti mandiamo un link via email, senza password."
        />
      </div>
    );
  }

  if (loading) return <p className="card text-sm text-slate-400">Caricamento…</p>;

  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-400">Non hai ancora richiesto nessuna prova.</p>
        <Link href="/" className="btn-primary mt-4">
          Prenota una prova
        </Link>
      </div>
    );
  }

  const today = toISODate(new Date());

  return (
    <div className="space-y-3">
      {error && <p className="card border-red-500/40 text-sm text-red-200">{error}</p>}

      {rows.map((row) => {
        const upcoming = row.day >= today;
        const cancellable = upcoming && (row.status === "pending" || row.status === "approved");
        return (
          <article key={row.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{formatDayLong(row.day)}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatTime(row.start_time)} – {formatTime(row.end_time)}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>

            {row.status === "pending" && (
              <p className="mt-3 text-xs text-slate-400">
                Il coach non ha ancora risposto. Ricontrolla questa pagina più tardi: appena
                decide, l&apos;esito compare qui.
              </p>
            )}

            {row.status === "approved" && (
              <p className="mt-3 text-xs text-slate-400">
                Ti aspettiamo. Presentati qualche minuto prima, con abbigliamento sportivo.
              </p>
            )}

            {row.status === "cancelled" && row.decided_at && (
              <p className="mt-3 text-xs text-slate-400">
                Questa prova è stata annullata dalla palestra. Puoi richiederne un&apos;altra
                quando vuoi.
              </p>
            )}

            {row.decision_note && (
              <p className="mt-3 rounded-lg border border-line bg-ink/50 p-3 text-xs text-slate-300">
                <span className="text-slate-500">Messaggio del coach: </span>
                {row.decision_note}
              </p>
            )}

            {cancellable && (
              <button
                className="btn-ghost mt-4 !px-3 !py-1.5 text-xs"
                onClick={() => void cancel(row.id)}
              >
                Annulla la richiesta
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
