"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Exercise } from "@/lib/types";

/**
 * Una scorciatoia, non un vincolo. Il campo della scheda resta testo
 * libero: queste pastiglie servono solo a non riscrivere «Piegamenti»
 * venti volte. Serie e ripetizioni restano a mano, perché quelle
 * cambiano ogni volta e una libreria non le può sapere.
 */
export default function ExercisePicker({
  onPick,
}: {
  /** Riceve il nome da infilare dove sta il cursore. */
  onPick: (name: string) => void;
}) {
  const [items, setItems] = useState<Exercise[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("active", true)
      .order("name");
    setItems((data as Exercise[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNew() {
    const name = draft.trim();
    if (!name) return;
    setError(null);
    const { error } = await supabase.from("exercises").insert({ name, unit: "reps" });
    if (error) {
      setError(error.code === "23505" ? "C'è già." : "Non riesco ad aggiungerlo.");
      return;
    }
    setDraft("");
    setAdding(false);
    await load();
    onPick(name);
  }

  if (items.length === 0 && !adding) {
    return (
      <button
        type="button"
        className="text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300"
        onClick={() => setAdding(true)}
      >
        La libreria esercizi è vuota — aggiungine uno
      </button>
    );
  }

  return (
    <div>
      <p className="label !mb-2">Tocca per inserire</p>

      <div className="flex flex-wrap gap-1.5">
        {items.map((e) => (
          <button
            key={e.id}
            type="button"
            className="min-h-[36px] rounded-lg border border-line px-2.5 text-[13px] text-slate-300 transition active:scale-[0.97] hover:border-slate-500 hover:bg-white/5"
            onClick={() => {
              onPick(e.name);
              // La nota serve proprio adesso, mentre scrive quella riga.
              setHint(e.notes?.trim() ? `${e.name}: ${e.notes.trim()}` : null);
            }}
          >
            {e.name}
          </button>
        ))}

        {!adding && (
          <button
            type="button"
            className="min-h-[36px] rounded-lg border border-dashed border-line px-2.5 text-[13px] text-slate-400 hover:border-slate-500 hover:bg-white/5"
            onClick={() => setAdding(true)}
          >
            + nuovo
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            className="field !py-2"
            autoFocus
            placeholder="Nome dell'esercizio"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addNew();
              }
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <button
            type="button"
            className="btn-ghost !min-h-[42px] shrink-0 !px-3 text-xs"
            onClick={() => void addNew()}
            disabled={!draft.trim()}
          >
            Aggiungi
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-200">{error}</p>}
      {hint && <p className="mt-2 text-xs text-accentSoft">{hint}</p>}
    </div>
  );
}
