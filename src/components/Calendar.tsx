"use client";

import { useMemo, useState } from "react";
import { addDays, parseISODate, toISODate } from "@/lib/date";

export type CalendarDay = {
  day: string;
  remaining: number;
};

const WEEK_HEADERS = ["L", "M", "M", "G", "V", "S", "D"];

/** Lunedì = 0 … Domenica = 6 */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function Calendar({
  days,
  selectedDay,
  onSelect,
  horizonDays,
}: {
  days: CalendarDay[];
  selectedDay: string | null;
  onSelect: (day: string) => void;
  horizonDays: number;
}) {
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const lastBookable = useMemo(() => addDays(today, horizonDays), [today, horizonDays]);

  const [cursor, setCursor] = useState<Date>(() =>
    startOfMonth(selectedDay ? parseISODate(selectedDay) : today)
  );

  const canGoBack = cursor > startOfMonth(today);
  const canGoForward = cursor < startOfMonth(lastBookable);

  // Celle vuote iniziali + giorni del mese: la griglia resta allineata
  // alle colonne dei giorni della settimana.
  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const leading = Array.from({ length: mondayIndex(first) }, () => null);
    const dates = Array.from(
      { length: daysInMonth },
      (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)
    );
    return [...leading, ...dates];
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mese precedente"
          disabled={!canGoBack}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="btn-ghost !px-3 !py-1.5 disabled:opacity-25"
        >
          ‹
        </button>
        <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        <button
          type="button"
          aria-label="Mese successivo"
          disabled={!canGoForward}
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="btn-ghost !px-3 !py-1.5 disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEK_HEADERS.map((header, index) => (
          <div key={index} className="pb-1 text-center text-xs font-medium text-slate-500">
            {header}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} />;

          const iso = toISODate(date);
          const entry = byDay.get(iso);
          const isToday = sameMonth(date, today) && date.getDate() === today.getDate();
          const isSelected = iso === selectedDay;
          const available = (entry?.remaining ?? 0) > 0;

          return (
            <button
              key={iso}
              type="button"
              disabled={!available}
              aria-label={`${date.getDate()} ${monthLabel}, ${
                available ? "disponibile" : "non disponibile"
              }`}
              aria-pressed={isSelected}
              onClick={() => onSelect(iso)}
              className={[
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition",
                isSelected
                  ? "border-accent bg-accent/15 font-semibold text-accentSoft"
                  : available
                    ? "border-line bg-ink/40 text-slate-100 hover:border-accent/60 hover:bg-accent/5"
                    : "border-transparent text-slate-600",
                !available ? "cursor-not-allowed" : "",
              ].join(" ")}
            >
              <span className={isToday && !isSelected ? "underline underline-offset-4" : ""}>
                {date.getDate()}
              </span>
              {available && !isSelected && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        giorni con posti liberi
      </p>
    </div>
  );
}
