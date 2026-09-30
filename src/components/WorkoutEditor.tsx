"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import { toWorkout, type WorkoutRow } from "@/lib/types";

type Draft = { day_id: string | null; title: string; body: string };

const EMPTY: Draft[] = [
  { day_id: null, title: "Giorno A", body: "" },
  { day_id: null, title: "Giorno B", body: "" },
];

export default function WorkoutEditor({
  workoutId,
  studentId,
  coachId,
  onClose,
  onSaved,
}: {
  workoutId: string | null;
  studentId: string | null;
  coachId: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [days, setDays] = useState<Draft[]>(EMPTY);
  const [open, setOpen] = useState(0);
  const [loading, setLoading] = useState(workoutId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Correggere un refuso non deve suonare il telefono di nessuno:
  // decide il coach, invece di indovinarlo noi.
  const [notify, setNotify] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    if (!workoutId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_workout", { p_workout_id: workoutId });
    if (error) setError(bookingErrorMessage(error));
    const w = toWorkout((data as WorkoutRow[]) ?? []);
    if (w) {
      setName(w.name);
      setIntro(w.intro ?? "");
      setDays(w.days.map((d) => ({ day_id: d.day_id, title: d.title, body: d.body })));
    }
    setLoading(false);
  }, [workoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Il campo cresce col testo: una scheda lunga in una finestrella di
  // tre righe non si rilegge, e ridimensionarla a mano da telefono non
  // si può.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 220)}px`;
  }, [open, days]);

  function edit(index: number, patch: Partial<Draft>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("Dai un nome alla scheda.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("save_workout", {
      p_workout_id: workoutId,
      p_student_id: studentId,
      p_name: name.trim(),
      p_days: days.map((d) => ({ title: d.title.trim(), body: d.body })),
      p_intro: intro.trim() || null,
      p_coach_id: coachId,
      p_notify: studentId !== null && notify,
    });
    setSaving(false);
    if (error) setError(bookingErrorMessage(error));
    else await onSaved();
  }

  if (loading) return <p className="card text-sm text-slate-400">Caricamento…</p>;

  return (
    <div className="space-y-4">
      <button className="btn-ghost !min-h-[38px] !px-3 text-xs" onClick={onClose}>
        ← Indietro
      </button>

      <section className="card">
        <div>
          <label className="label" htmlFor="w-name">
            Nome della scheda
          </label>
          <input
            id="w-name"
            className="field"
            placeholder="Base 3 giorni, Blocco forza…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="w-intro">
            Indicazioni generali (facoltative)
          </label>
          <textarea
            id="w-intro"
            className="field min-h-[64px] resize-y"
            placeholder="Un giorno di riposo fra uno e l'altro, riscaldamento sempre…"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <p className="label">Giorni</p>
          <div className="flex gap-2">
            {[2, 3].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={days.length === n}
                onClick={() => {
                  setDays((prev) =>
                    n > prev.length
                      ? [...prev, { day_id: null, title: `Giorno ${"ABC"[prev.length]}`, body: "" }]
                      : prev.slice(0, n)
                  );
                  setOpen((o) => Math.min(o, n - 1));
                }}
                className={[
                  "min-h-[44px] flex-1 rounded-xl border text-sm transition",
                  days.length === n
                    ? "border-accent/60 bg-accent/15 font-semibold text-accentSoft"
                    : "border-line text-slate-300 hover:bg-white/5",
                ].join(" ")}
              >
                {n} giorni
              </button>
            ))}
          </div>
          {days.length === 3 && days[2].body.trim() === "" && (
            <p className="mt-2 text-xs text-slate-500">
              Tornando a due giorni il terzo viene eliminato.
            </p>
          )}
        </div>
      </section>

      <div className="flex gap-2">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className={[
              "min-h-[44px] flex-1 truncate rounded-xl border px-2 text-sm transition",
              open === i
                ? "border-accent/50 bg-accent/12 font-semibold text-accentSoft"
                : "border-line text-slate-300 hover:bg-white/5",
            ].join(" ")}
          >
            {d.title || `Giorno ${i + 1}`}
          </button>
        ))}
      </div>

      <section className="card">
        <label className="label" htmlFor="d-title">
          Titolo del giorno
        </label>
        <input
          id="d-title"
          className="field"
          placeholder="Spinta, Tirata, Gambe…"
          value={days[open]?.title ?? ""}
          onChange={(e) => edit(open, { title: e.target.value })}
        />

        <label className="label mt-4" htmlFor="d-body">
          Allenamento
        </label>
        {/* Testo libero: si scrive o si incolla come in una nota. Una
            griglia di esercizi sarebbe più ordinata e nessuno la
            compilerebbe. */}
        <textarea
          id="d-body"
          ref={bodyRef}
          className="field resize-y font-mono text-[15px] leading-relaxed sm:text-sm"
          placeholder={"Riscaldamento 10'\n\nTrazioni 4x5\nPiegamenti 4x8\nPlank 3x40\""}
          value={days[open]?.body ?? ""}
          onChange={(e) => edit(open, { body: e.target.value })}
        />
      </section>

      {studentId && (
        <label className="card flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          <span className="text-slate-300">
            Avvisa l&apos;allievo
            <span className="mt-1 block text-xs text-slate-500">
              Gli arriva una notifica sul telefono, se le ha attivate. Togli la
              spunta se stai solo correggendo un refuso.
            </span>
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-200">{error}</p>}

      <div className="action-bar flex gap-2">
        <button className="btn-ghost flex-1" onClick={onClose} disabled={saving}>
          Annulla
        </button>
        <button className="btn-primary flex-1" onClick={() => void save()} disabled={saving}>
          {saving ? "Salvo…" : "Salva e assegna"}
        </button>
      </div>
    </div>
  );
}
