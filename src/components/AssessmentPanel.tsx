"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import { formatDayLong, toISODate } from "@/lib/date";
import { UNIT_LABEL, type AssessmentRow, type Exercise } from "@/lib/types";

export default function AssessmentPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, e] = await Promise.all([
      supabase.rpc("get_assessments", { p_user_id: userId }),
      supabase.from("exercises").select("*").eq("active", true).order("name"),
    ]);
    setRows((a.data as AssessmentRow[]) ?? []);
    setExercises((e.data as Exercise[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Righe piatte dal database, raggruppate per data: una valutazione è
  // una sola misurazione, non una riga per esercizio.
  const sessions = useMemo(() => {
    const byId = new Map<string, { day: string; notes: string | null; items: AssessmentRow[] }>();
    for (const r of rows) {
      const s = byId.get(r.assessment_id) ?? { day: r.day, notes: r.notes, items: [] };
      s.items.push(r);
      byId.set(r.assessment_id, s);
    }
    return [...byId.entries()].map(([id, s]) => ({ id, ...s }));
  }, [rows]);

  /** Quanto è cambiato rispetto alla volta prima, che è il punto di misurare. */
  function previous(exerciseId: string, index: number): number | null {
    for (let i = index + 1; i < sessions.length; i++) {
      const hit = sessions[i].items.find((x) => x.exercise_id === exerciseId);
      if (hit) return Number(hit.value);
    }
    return null;
  }

  if (loading) return <p className="card text-sm text-slate-400">Caricamento…</p>;

  return (
    <div className="space-y-4">
      {!open && (
        <button className="btn-primary w-full" onClick={() => setOpen(true)}>
          Nuova valutazione
        </button>
      )}

      {open && (
        <NewAssessment
          userId={userId}
          exercises={exercises}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}

      {sessions.length === 0 && !open && (
        <p className="card text-sm text-slate-400">
          Ancora nessuna misurazione. La prima è il punto di partenza: senza
          quella, i progressi sono un&apos;impressione.
        </p>
      )}

      {sessions.map((s, i) => (
        <section className="card" key={s.id}>
          <h3 className="text-base font-semibold">{formatDayLong(s.day)}</h3>
          {s.notes && <p className="mt-1 text-sm text-slate-400">{s.notes}</p>}
          <ul className="mt-3 space-y-1.5">
            {s.items.map((item) => {
              const before = previous(item.exercise_id, i);
              const delta = before === null ? null : Number(item.value) - before;
              return (
                <li
                  key={`${s.id}-${item.exercise_id}`}
                  className="flex items-baseline gap-2 border-b border-line/60 pb-1.5 text-sm last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {item.exercise_name}
                  </span>
                  <span className="font-semibold">{Number(item.value)}</span>
                  <span className="text-xs text-slate-500">{UNIT_LABEL[item.unit]}</span>
                  {delta !== null && delta !== 0 && (
                    <span
                      className={[
                        "text-xs font-medium",
                        delta > 0 ? "text-emerald-300" : "text-slate-400",
                      ].join(" ")}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NewAssessment({
  userId,
  exercises,
  onClose,
  onSaved,
}: {
  userId: string;
  exercises: Exercise[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [day, setDay] = useState(toISODate(new Date()));
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = exercises.filter((e) => (values[e.id] ?? "").trim() !== "");

  async function save() {
    setError(null);
    if (filled.length === 0) {
      setError("Compila almeno un esercizio.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("save_assessment", {
      p_user_id: userId,
      p_day: day,
      p_items: filled.map((e) => ({
        exercise_id: e.id,
        value: Number(values[e.id].replace(",", ".")),
        unit: e.unit,
      })),
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) setError(bookingErrorMessage(error));
    else await onSaved();
  }

  if (exercises.length === 0) {
    return (
      <section className="card">
        <p className="text-sm text-slate-300">
          Prima servono gli esercizi da misurare: aggiungili nella sezione
          Esercizi.
        </p>
        <button className="btn-ghost mt-3" onClick={onClose}>
          Chiudi
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h3 className="text-base font-semibold">Nuova valutazione</h3>

      <div className="mt-4">
        <label className="label" htmlFor="as-day">
          Data
        </label>
        <input
          id="as-day"
          type="date"
          className="field"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </div>

      <p className="mt-5 text-xs uppercase tracking-wide text-slate-400">
        Lascia vuoto quello che non hai misurato
      </p>
      <ul className="mt-2 space-y-2">
        {exercises.map((e) => (
          <li key={e.id} className="flex items-center gap-3">
            <label className="min-w-0 flex-1 truncate text-sm" htmlFor={`ex-${e.id}`}>
              {e.name}
              <span className="ml-1.5 text-xs text-slate-500">{UNIT_LABEL[e.unit]}</span>
            </label>
            <input
              id={`ex-${e.id}`}
              className="field !w-24 text-center"
              inputMode="decimal"
              placeholder="—"
              value={values[e.id] ?? ""}
              onChange={(ev) => setValues((p) => ({ ...p, [e.id]: ev.target.value }))}
            />
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <label className="label" htmlFor="as-notes">
          Note (facoltative)
        </label>
        <textarea
          id="as-notes"
          className="field min-h-[72px] resize-y"
          placeholder="Com'è andata, cosa hai notato…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}

      <div className="action-bar mt-4 flex gap-2">
        <button className="btn-ghost flex-1" onClick={onClose} disabled={saving}>
          Annulla
        </button>
        <button
          className="btn-primary flex-1"
          onClick={() => void save()}
          disabled={saving || filled.length === 0}
        >
          {saving ? "Salvo…" : `Salva (${filled.length})`}
        </button>
      </div>
    </section>
  );
}
