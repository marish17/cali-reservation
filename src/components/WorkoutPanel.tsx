"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import WorkoutEditor from "@/components/WorkoutEditor";
import type { WorkoutSummary } from "@/lib/types";

export default function WorkoutPanel({
  userId,
  coachId,
}: {
  userId: string;
  coachId: string | null;
}) {
  const [items, setItems] = useState<WorkoutSummary[]>([]);
  const [templates, setTemplates] = useState<WorkoutSummary[]>([]);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [mine, tpl] = await Promise.all([
      supabase.rpc("list_workouts", { p_student_id: userId }),
      supabase.rpc("list_workouts", { p_student_id: null }),
    ]);
    setItems((mine.data as WorkoutSummary[]) ?? []);
    setTemplates((tpl.data as WorkoutSummary[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function fromTemplate(id: string) {
    setError(null);
    const { data, error } = await supabase.rpc("duplicate_workout", {
      p_workout_id: id,
      p_student_id: userId,
    });
    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    await load();
    setEditing(data as string);
  }

  async function setStatus(id: string, status: "active" | "archived") {
    setError(null);
    const { error } = await supabase.rpc("set_workout_status", {
      p_workout_id: id,
      p_status: status,
    });
    if (error) setError(bookingErrorMessage(error));
    await load();
  }

  if (editing) {
    return (
      <WorkoutEditor
        workoutId={editing === "new" ? null : editing}
        studentId={userId}
        coachId={coachId}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  if (loading) return <p className="card text-sm text-slate-400">Caricamento…</p>;

  const active = items.find((w) => w.status === "active");
  const archived = items.filter((w) => w.status === "archived");

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-200">{error}</p>}

      {active ? (
        <section className="card border-accent/35">
          <p className="text-xs uppercase tracking-wide text-accentSoft">Scheda in corso</p>
          <h3 className="mt-1 text-base font-semibold">{active.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {active.days} giorni · aggiornata il{" "}
            {new Date(active.updated_at).toLocaleDateString("it-IT")}
          </p>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary flex-1" onClick={() => setEditing(active.id)}>
              Modifica
            </button>
            <button
              className="btn-ghost flex-1"
              onClick={() => void setStatus(active.id, "archived")}
            >
              Archivia
            </button>
          </div>
        </section>
      ) : (
        <p className="card text-sm text-slate-400">Nessuna scheda in corso.</p>
      )}

      <button className="btn-primary w-full" onClick={() => setEditing("new")}>
        {active ? "Scrivi una nuova scheda" : "Scrivi la scheda"}
      </button>

      {templates.length > 0 && (
        <section className="card">
          <h3 className="text-base font-semibold">Parti da un modello</h3>
          <p className="mt-1 text-sm text-slate-400">
            Ne crea una copia per questa persona: quello che cambi qui non
            tocca il modello.
          </p>
          <ul className="mt-3 space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="text-xs text-slate-500">{t.days} giorni</span>
                <button
                  className="btn-ghost !min-h-[34px] !px-2.5 text-xs"
                  onClick={() => void fromTemplate(t.id)}
                >
                  Usa
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section className="card">
          <h3 className="text-base font-semibold">Schede precedenti</h3>
          <ul className="mt-3 space-y-2">
            {archived.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                <span className="text-xs text-slate-500">
                  {new Date(w.updated_at).toLocaleDateString("it-IT")}
                </span>
                <button
                  className="btn-ghost !min-h-[34px] !px-2.5 text-xs"
                  onClick={() => setEditing(w.id)}
                >
                  Apri
                </button>
                <button
                  className="btn-ghost !min-h-[34px] !px-2.5 text-xs"
                  onClick={() => void setStatus(w.id, "active")}
                >
                  Riprendi
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
