"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import IntakeForm from "@/components/IntakeForm";
import AssessmentPanel from "@/components/AssessmentPanel";
import { supabase } from "@/lib/supabase";
import type { Coach, Person } from "@/lib/types";

type Tab = "questionario" | "valutazioni";

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
  const [tab, setTab] = useState<Tab>("questionario");
  const [coachId, setCoachId] = useState(person.coach_id ?? "");
  const [saving, setSaving] = useState(false);

  async function assign(next: string) {
    setCoachId(next);
    setSaving(true);
    // La riga allievo può non esistere ancora: assegnare un coach è uno
    // dei modi per farla nascere.
    await supabase
      .from("students")
      .upsert(
        { user_id: person.user_id, coach_id: next || null },
        { onConflict: "user_id" }
      );
    setSaving(false);
    await onChanged();
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
      </section>

      <div className="flex gap-2">
        {(["questionario", "valutazioni"] as Tab[]).map((t) => (
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

      {tab === "questionario" ? (
        <IntakeForm userId={person.user_id} onSaved={onChanged} />
      ) : (
        <AssessmentPanel userId={person.user_id} />
      )}
    </div>
  );
}
