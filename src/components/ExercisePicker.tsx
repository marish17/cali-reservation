"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
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

  // Con quaranta esercizi in libreria una striscia che si allunga
  // all'infinito spinge fuori schermo il campo in cui si scrive: è il
  // contrario di quello che doveva servire. Si cerca e si scorre.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => e.name.toLowerCase().includes(q));
  }, [items, query]);

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
      <div className="mb-2 flex items-center gap-2">
        <p className="label !mb-0 shrink-0">Tocca per inserire</p>
        {items.length > 8 && (
          <input
            className="field !w-auto min-w-0 flex-1 !py-1.5 !text-[13px]"
            type="search"
            placeholder="Cerca…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      {/* Tre righe al massimo, poi si scorre: così il campo di
          scrittura resta sempre sotto gli occhi. */}
      <div className="flex max-h-[7.5rem] flex-wrap gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-line bg-ink/40 p-2">
        {shown.length === 0 && (
          <p className="px-1 py-1.5 text-[13px] text-slate-500">
            Nessun esercizio con questo nome.
          </p>
        )}
        {shown.map((e) => (
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

      </div>

      {!adding && (
        <button
          type="button"
          className="mt-2 text-[13px] text-slate-400 underline underline-offset-4 hover:text-slate-200"
          onClick={() => {
            setAdding(true);
            setQuery("");
          }}
        >
          + aggiungi un esercizio
        </button>
      )}

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
