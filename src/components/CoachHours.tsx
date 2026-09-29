"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDayLong, formatTime } from "@/lib/date";
import type { CoachAbsence, CoachHour } from "@/lib/types";

const WEEKDAYS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

/**
 * Quando trovi il tuo coach in palestra, e quando non lo trovi.
 * Sono gli stessi orari su cui si aprono le prove: qui non servono a
 * prenotare, servono a sapere che c'è.
 */
export default function CoachHours() {
  const [hours, setHours] = useState<CoachHour[]>([]);
  const [absences, setAbsences] = useState<CoachAbsence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [h, a] = await Promise.all([
        supabase.rpc("get_my_coach_hours"),
        supabase.rpc("get_my_coach_absences"),
      ]);
      setHours((h.data as CoachHour[]) ?? []);
      setAbsences((a.data as CoachAbsence[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  // Senza un coach assegnato non c'è niente di vero da dire: meglio
  // niente che una tabella vuota.
  if (hours.length === 0 && absences.length === 0) return null;

  const coachName = hours[0]?.coach_name ?? absences[0]?.coach_name ?? "";

  // Più fasce nello stesso giorno diventano una riga sola.
  const byDay = new Map<number, CoachHour[]>();
  for (const h of hours) {
    byDay.set(h.weekday, [...(byDay.get(h.weekday) ?? []), h]);
  }

  return (
    <section className="card">
      <h3 className="text-base font-semibold">Quando trovi {coachName}</h3>

      {byDay.size > 0 && (
        <ul className="mt-3 space-y-1.5">
          {[...byDay.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([weekday, slots]) => (
              <li
                key={weekday}
                className="flex items-baseline gap-3 border-b border-line/60 pb-1.5 text-sm last:border-0"
              >
                <span className="w-24 shrink-0 text-slate-300">{WEEKDAYS[weekday]}</span>
                <span className="text-slate-400">
                  {slots
                    .map((s) => `${formatTime(s.start_time)}–${formatTime(s.end_time)}`)
                    .join(", ")}
                </span>
              </li>
            ))}
        </ul>
      )}

      {absences.length > 0 && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/[0.07] p-3">
          <p className="text-xs uppercase tracking-wide text-accentSoft">
            {absences.length === 1 ? "Assenza annunciata" : "Assenze annunciate"}
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-300">
            {absences.map((a) => (
              <li key={`${a.from_day}-${a.to_day}`}>
                {a.from_day === a.to_day
                  ? formatDayLong(a.from_day)
                  : `Dal ${formatDayLong(a.from_day)} al ${formatDayLong(a.to_day)}`}
                {a.reason && <span className="text-slate-400"> · {a.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
