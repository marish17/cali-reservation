"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import { formatDayLong, formatTime, toISODate } from "@/lib/date";

type Absence = { id: string; from_day: string; to_day: string; reason: string | null };

type Covered = {
  booking_id: string;
  day: string;
  start_time: string;
  end_time: string;
  full_name: string;
  phone: string;
  email: string;
  status: string;
};

/**
 * Assenze di un coach. Le sue fasce spariscono dal calendario per quel
 * periodo, quelle degli altri restano.
 *
 * Le prove già confermate non vengono toccate: si elencano e decide il
 * coach. Annullare da soli una cosa promessa a qualcuno non è una
 * decisione che spetta al software.
 */
export default function CoachAbsences({ coachId }: { coachId: string }) {
  const today = toISODate(new Date());

  const [absences, setAbsences] = useState<Absence[]>([]);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [covered, setCovered] = useState<Covered[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("coach_absences")
      .select("id, from_day, to_day, reason")
      .eq("coach_id", coachId)
      .gte("to_day", today)
      .order("from_day");
    setAbsences((data as Absence[]) ?? []);
  }, [coachId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Prima di segnare, si guarda chi resterebbe scoperto. */
  async function check() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("bookings_covered_by_coach", {
      p_coach_id: coachId,
      p_from: from,
      p_to: to,
    });
    setBusy(false);
    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    setCovered((data as Covered[]) ?? []);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("coach_absences").insert({
      coach_id: coachId,
      from_day: from,
      to_day: to,
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError("Non è stato possibile segnare l'assenza.");
      return;
    }
    setCovered(null);
    setOpen(false);
    setReason("");
    void load();
  }

  async function cancelBooking(row: Covered) {
    if (!confirm2(`Annullare la prova di ${row.full_name}?`)) return;
    const { error } = await supabase.rpc("decide_booking", {
      p_booking_id: row.booking_id,
      p_status: "cancelled",
      p_note: reason.trim() || "Il coach non è disponibile in questa data",
    });
    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    setCovered((current) => current?.filter((c) => c.booking_id !== row.booking_id) ?? null);
  }

  async function remove(id: string) {
    if (!confirm2("Togliere questa assenza? Le fasce tornano prenotabili.")) return;
    await supabase.from("coach_absences").delete().eq("id", id);
    void load();
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Assenze</span>
        <button
          className="btn-ghost !min-h-[34px] !px-3 text-xs"
          onClick={() => {
            setOpen(!open);
            setCovered(null);
            setError(null);
          }}
        >
          {open ? "Annulla" : "Segna un'assenza"}
        </button>
      </div>

      {absences.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {absences.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs"
            >
              <span className="first-letter:uppercase">
                {a.from_day === a.to_day
                  ? formatDayLong(a.from_day)
                  : `${formatDayLong(a.from_day)} → ${formatDayLong(a.to_day)}`}
              </span>
              {a.reason && <span className="text-slate-500">{a.reason}</span>}
              <button
                className="ml-auto text-slate-400 underline underline-offset-2 hover:text-slate-200"
                onClick={() => void remove(a.id)}
              >
                togli
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && covered === null && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
          <div>
            <label className="label">Dal</label>
            <input
              type="date"
              className="field !w-auto"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value > to) setTo(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="label">Al</label>
            <input
              type="date"
              className="field !w-auto"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Motivo (facoltativo)</label>
            <input
              className="field"
              placeholder="Ferie, imprevisto…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button className="btn-primary text-sm" onClick={() => void check()} disabled={busy}>
            {busy ? "Controllo…" : "Continua"}
          </button>
        </div>
      )}

      {covered !== null && (
        <div className="mt-3 rounded-xl border border-accent/45 bg-accent/[0.07] p-4">
          {covered.length === 0 ? (
            <p className="text-sm text-slate-200">
              Nessuna prova prenotata in quel periodo. Puoi segnare l&apos;assenza.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-200">
                In quel periodo {covered.length === 1 ? "c'è" : "ci sono"} {covered.length}{" "}
                {covered.length === 1 ? "prova" : "prove"} che {covered.length === 1 ? "resta" : "restano"}{" "}
                senza coach. Decidi tu cosa farne: se le copre qualcun altro, lasciale.
              </p>
              <ul className="mt-3 space-y-2">
                {covered.map((row) => (
                  <li
                    key={row.booking_id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-ink/50 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold">{row.full_name}</span>
                    <span className="text-slate-400 first-letter:uppercase">
                      {formatDayLong(row.day)} · {formatTime(row.start_time)}
                    </span>
                    <a className="text-slate-400 hover:text-slate-200" href={`tel:${row.phone}`}>
                      {row.phone}
                    </a>
                    <button
                      className="ml-auto text-accentSoft underline underline-offset-2"
                      onClick={() => void cancelBooking(row)}
                    >
                      annulla la prova
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary text-sm" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Attendi…" : "Segna l'assenza"}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setCovered(null)}>
              Torna indietro
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
    </div>
  );
}

/** Il nome `confirm` è già preso dalla funzione che conferma l'assenza. */
function confirm2(message: string): boolean {
  return window.confirm(message);
}
