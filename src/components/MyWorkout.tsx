"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import { toWorkout, type WorkoutRow } from "@/lib/types";

type Workout = NonNullable<ReturnType<typeof toWorkout>>;

export default function MyWorkout({ onEmpty }: { onEmpty?: () => void }) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_my_workout");
    const w = toWorkout((data as WorkoutRow[]) ?? []);
    setWorkout(w);
    setLoading(false);
    if (!w) onEmpty?.();
  }, [onEmpty]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="card text-sm text-slate-400">Caricamento…</p>;
  if (!workout) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">{workout.name}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Aggiornata il {new Date(workout.updatedAt).toLocaleDateString("it-IT")}
        </p>
      </div>

      {workout.intro && (
        <p className="card whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {workout.intro}
        </p>
      )}

      {workout.days.map((day, i) => (
        <DayCard
          key={day.day_id ?? i}
          index={i}
          title={day.title}
          body={day.body}
          note={day.note ?? ""}
          dayId={day.day_id}
        />
      ))}
    </div>
  );
}

function DayCard({
  index,
  title,
  body,
  note,
  dayId,
}: {
  index: number;
  title: string;
  body: string;
  note: string;
  dayId: string | null;
}) {
  const [text, setText] = useState(note);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  async function save() {
    if (!dayId) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("save_workout_note", {
      p_day_id: dayId,
      p_body: text,
    });
    setSaving(false);
    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    setEditing(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="card">
      <div className="flex items-center gap-2.5">
        <span className="step-number">{index + 1}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>

      {/* Il testo si mostra com'è stato scritto: le righe e gli spazi
          sono il modo in cui il coach l'ha separato. */}
      <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[15px] leading-relaxed text-slate-200 sm:text-sm">
        {body.trim() || "—"}
      </pre>

      <div className="mt-4 border-t border-line pt-3">
        {editing ? (
          <>
            <label className="label" htmlFor={`note-${dayId}`}>
              Le tue note
            </label>
            <textarea
              id={`note-${dayId}`}
              ref={ref}
              className="field min-h-[96px] resize-y"
              placeholder="Come è andata, i carichi, cosa ti ha dato fastidio…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button
                className="btn-ghost flex-1"
                onClick={() => {
                  setText(note);
                  setEditing(false);
                }}
                disabled={saving}
              >
                Annulla
              </button>
              <button className="btn-primary flex-1" onClick={() => void save()} disabled={saving}>
                {saving ? "Salvo…" : "Salva la nota"}
              </button>
            </div>
          </>
        ) : (
          <button
            className="w-full text-left"
            onClick={() => setEditing(true)}
            aria-label="Scrivi una nota su questo giorno"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Le tue note {saved && <span className="text-emerald-300">· salvate</span>}
            </span>
            <span className="mt-1 block whitespace-pre-wrap text-sm text-slate-300">
              {text.trim() || (
                <span className="text-slate-500">
                  Tocca per annotare com&apos;è andata. Le legge il tuo coach.
                </span>
              )}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
