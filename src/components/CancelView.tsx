"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import { formatDayLong, formatTime } from "@/lib/date";

type BookingView = {
  day: string;
  start_time: string;
  end_time: string;
  full_name: string;
  coach_name: string;
  status: "confirmed" | "cancelled";
};

export default function CancelView() {
  const token = useSearchParams().get("token");
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link non valido: manca il codice della prenotazione.");
      setLoading(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase.rpc("get_booking_by_token", { p_token: token });
      const row = ((data as BookingView[]) ?? [])[0] ?? null;
      if (error || !row) setError("Prenotazione non trovata. Controlla il link.");
      else setBooking(row);
      setLoading(false);
    })();
  }, [token]);

  async function cancel() {
    if (!token) return;
    setWorking(true);
    setError(null);
    const { error } = await supabase.rpc("cancel_booking", { p_token: token });
    setWorking(false);
    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    setBooking((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
  }

  if (loading) return <div className="card">Caricamento…</div>;

  if (error && !booking) {
    return (
      <div className="card border-red-500/40">
        <p className="text-sm text-red-200">{error}</p>
        <a className="btn-ghost mt-4" href="/">
          Torna alla prenotazione
        </a>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="card">
      <p className="text-sm text-slate-400">Prenotazione di</p>
      <p className="text-lg font-semibold">{booking.full_name}</p>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between border-b border-line pb-2">
          <dt className="text-slate-400">Giorno</dt>
          <dd>{formatDayLong(booking.day)}</dd>
        </div>
        <div className="flex justify-between border-b border-line pb-2">
          <dt className="text-slate-400">Orario</dt>
          <dd>
            {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Coach</dt>
          <dd>{booking.coach_name}</dd>
        </div>
      </dl>

      {booking.status === "cancelled" ? (
        <div className="mt-6">
          <p className="rounded-xl border border-line bg-ink/50 px-4 py-3 text-sm text-slate-300">
            Questa prenotazione è stata disdetta. Il posto è di nuovo libero.
          </p>
          <a className="btn-primary mt-4" href="/">
            Prenota un&apos;altra data
          </a>
        </div>
      ) : (
        <div className="mt-6">
          {error && <p className="mb-3 text-sm text-red-200">{error}</p>}
          <button className="btn-primary" onClick={() => void cancel()} disabled={working}>
            {working ? "Annullamento…" : "Disdici la prova"}
          </button>
        </div>
      )}
    </div>
  );
}
