"use client";

import { useCallback, useEffect, useState } from "react";
import { INTAKE, touchesHealth, type IntakeQuestion } from "@/lib/intake";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import type { IntakeAnswer } from "@/lib/types";

type Answers = Record<string, string | string[]>;

export default function IntakeForm({
  userId,
  onSaved,
}: {
  userId: string;
  onSaved: () => void | Promise<void>;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.all([
      supabase.rpc("get_intake", { p_user_id: userId }),
      supabase
        .from("students")
        .select("health_consent_at, intake_updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const next: Answers = {};
    for (const row of (a.data as IntakeAnswer[]) ?? []) {
      const v = row.value;
      if (Array.isArray(v)) next[row.question_id] = v.map(String);
      else if (typeof v === "string") next[row.question_id] = v;
    }
    setAnswers(next);

    const given = (s.data as { health_consent_at: string | null } | null)?.health_consent_at ?? null;
    setConsentGiven(given);
    setConsent(Boolean(given));
    setSavedAt(
      (s.data as { intake_updated_at: string | null } | null)?.intake_updated_at ?? null
    );
    setDirty(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function set(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
  }

  const needsConsent = touchesHealth(answers) && !consent;

  async function save() {
    setError(null);
    if (needsConsent) {
      setError(
        "Le risposte sulla salute si salvano solo con il consenso della persona."
      );
      return;
    }
    setSaving(true);

    // Le risposte vuote non si mandano: il questionario è una fotografia
    // intera e quello che è stato cancellato deve sparire davvero.
    const payload: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (Array.isArray(v) ? v.length > 0 : v.trim() !== "") payload[k] = v;
    }

    const { error } = await supabase.rpc("save_intake", {
      p_user_id: userId,
      p_answers: payload,
      p_health_consent: consent,
    });
    setSaving(false);
    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    await load();
    await onSaved();
  }

  if (loading) return <p className="card text-sm text-slate-400">Caricamento…</p>;

  return (
    <div className="space-y-4">
      {savedAt && (
        <p className="text-xs text-slate-400">
          Ultimo aggiornamento: {new Date(savedAt).toLocaleString("it-IT")}
        </p>
      )}

      {INTAKE.map((section) => (
        <section className="card" key={section.title}>
          <h3 className="text-base font-semibold">{section.title}</h3>
          {section.note && <p className="mt-1 text-sm text-slate-400">{section.note}</p>}

          <div className="mt-4 space-y-5">
            {section.questions.map((q) => (
              <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
            ))}
          </div>

          {section.title === "Salute" && (
            <label className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-ink/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setDirty(true);
                }}
              />
              <span className="text-slate-300">
                La persona acconsente al trattamento dei dati sanitari per
                adattare l&apos;allenamento.
                {consentGiven && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Dato il {new Date(consentGiven).toLocaleDateString("it-IT")}. Per
                    revocarlo servono la richiesta della persona e la
                    cancellazione delle risposte.
                  </span>
                )}
              </span>
            </label>
          )}
        </section>
      ))}

      {error && <p className="text-sm text-red-200">{error}</p>}

      <div className="action-bar">
        <button
          className="btn-primary w-full"
          onClick={() => void save()}
          disabled={saving || !dirty}
        >
          {saving ? "Salvo…" : dirty ? "Salva il questionario" : "Nessuna modifica"}
        </button>
      </div>
    </div>
  );
}

function Question({
  q,
  value,
  onChange,
}: {
  q: IntakeQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-200">{q.label}</p>
      {q.hint && <p className="mt-0.5 text-xs text-slate-500">{q.hint}</p>}

      <div className="mt-2">
        {q.type === "single" && (
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                on={value === opt}
                // Ritoccare una risposta data per sbaglio deve costare un
                // tocco, non la ricerca di un pulsante "cancella".
                onClick={() => onChange(value === opt ? "" : opt)}
              />
            ))}
          </div>
        )}

        {q.type === "multi" && (
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const list = Array.isArray(value) ? value : [];
              const on = list.includes(opt);
              return (
                <Chip
                  key={opt}
                  label={opt}
                  on={on}
                  onClick={() =>
                    onChange(on ? list.filter((x) => x !== opt) : [...list, opt])
                  }
                />
              );
            })}
          </div>
        )}

        {q.type === "text" && (
          <input
            className="field"
            placeholder={q.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {q.type === "long" && (
          <textarea
            className="field min-h-[84px] resize-y"
            placeholder={q.placeholder}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

/** Bersaglio grande: si compila col telefono in mano, in piedi. */
function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={[
        "min-h-[40px] rounded-xl border px-3.5 text-sm transition active:scale-[0.97]",
        on
          ? "border-accent/60 bg-accent/15 font-semibold text-accentSoft"
          : "border-line text-slate-300 hover:bg-white/5",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
