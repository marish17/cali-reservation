"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import IntakeForm from "@/components/IntakeForm";
import AssessmentPanel from "@/components/AssessmentPanel";
import WorkoutPanel from "@/components/WorkoutPanel";
import PersonDanger from "@/components/PersonDanger";
import { supabase } from "@/lib/supabase";
import type { Coach, Person } from "@/lib/types";

type Tab = "scheda" | "questionario" | "valutazioni";

export default function PersonDetail({
  person,
  coaches,
  onBack,
  onChanged,
}: {
  person: Person;
  coaches: Coach[];
  onBack: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("scheda");
  const [coachId, setCoachId] = useState(person.coach_id ?? "");
  const [enrolled, setEnrolled] = useState(person.enrolled);
  const [saving, setSaving] = useState(false);

  async function assign(next: string) {
    setCoachId(next);
    setSaving(true);
    // La riga allievo può non esistere ancora: assegnare un coach è uno
    // dei modi per farla nascere. «Nessuno» ha una funzione sua, perché
    // un parametro nullo vuol dire "non toccare".
    if (next) {
      await supabase.rpc("set_student", { p_user_id: person.user_id, p_coach_id: next });
    } else {
      await supabase.rpc("clear_student_coach", { p_user_id: person.user_id });
    }
    setSaving(false);
    await onChanged();
  }

  async function setEnrolledFlag(next: boolean) {
    setEnrolled(next);
    setSaving(true);
    await supabase.rpc("set_student", { p_user_id: person.user_id, p_enrolled: next });
    setSaving(false);
    await onChanged();
  }

  async function setActive(next: boolean) {
    setSaving(true);
    await supabase.rpc("set_student", { p_user_id: person.user_id, p_active: next });
    setSaving(false);
    await onChanged();
    onBack();
  }

  return (
    <div className="space-y-4">
      <button className="btn-ghost !min-h-[38px] !px-3 text-xs" onClick={onBack}>
        ← Tutte le persone
      </button>

      <section className="card">
        <div className="flex items-center gap-3">
          <Avatar
            name={person.display_name}
            email={person.email}
            path={person.avatar_path}
            size={48}
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {person.display_name || person.email || "Senza nome"}
            </h2>
            {person.display_name && person.email && (
              <p className="truncate text-xs text-slate-400">{person.email}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="coach-assign">
            Segue
          </label>
          <select
            id="coach-assign"
            className="field"
            value={coachId}
            onChange={(e) => void assign(e.target.value)}
            disabled={saving}
          >
            <option value="">Nessuno in particolare</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chi è iscritto la prova l'ha già fatta, o l'ha fatta prima
            che questa app esistesse: mostrargli il calendario delle
            prove non ha senso. */}
        <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-ink/40 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
            checked={enrolled}
            disabled={saving}
            onChange={(e) => void setEnrolledFlag(e.target.checked)}
          />
          <span className="text-slate-300">
            Allievo iscritto
            <span className="mt-1 block text-xs text-slate-500">
              Non vede più le prove né le richieste: solo la sua scheda e gli
              orari del coach che lo segue.
            </span>
          </span>
        </label>

        {!person.active && (
          <p className="mt-3 text-xs text-slate-500">
            Archiviato: non compare nell&apos;elenco attivo.
          </p>
        )}
      </section>

      <div className="flex gap-2">
        {(["scheda", "questionario", "valutazioni"] as Tab[]).map((t) => (
          <button
            key={t}
            className={[
              "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition",
              tab === t
                ? "border-accent/50 bg-accent/12 text-accentSoft"
                : "border-line text-slate-300 hover:bg-white/5",
            ].join(" ")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "scheda" && (
        <WorkoutPanel userId={person.user_id} coachId={coachId || null} />
      )}
      {tab === "questionario" && <IntakeForm userId={person.user_id} onSaved={onChanged} />}
      {tab === "valutazioni" && <AssessmentPanel userId={person.user_id} />}

      <div className="pt-2">
        <PersonDanger
          person={person}
          onArchive={setActive}
          onDeleted={async () => {
            await onChanged();
            onBack();
          }}
        />
      </div>
    </div>
  );
}
