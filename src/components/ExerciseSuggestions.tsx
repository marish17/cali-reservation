"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Suggestion = { name: string; uses: number };

/**
 * Gli esercizi che il coach ha già scritto nelle schede, proposti per
 * entrare in libreria.
 *
 * La macchina propone, il coach accetta. Leggere testo libero è
 * indovinare: una libreria che si riempie da sola di «Riscaldamento»
 * poi va ripulita a mano, che è peggio del problema di partenza.
 */
export default function ExerciseSuggestions({ onAdded }: { onAdded: () => void | Promise<void> }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("suggest_exercises");
    setItems((data as Suggestion[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(name: string) {
    setBusy(name);
    await supabase.from("exercises").insert({ name, unit: "reps" });
    await load();
    await onAdded();
    setBusy(null);
  }

  async function reject(name: string) {
    setBusy(name);
    await supabase.rpc("dismiss_exercise_name", { p_name: name });
    await load();
    setBusy(null);
  }

  if (loading || items.length === 0) return null;

  return (
    <section className="card border-accent/35">
      <h2 className="text-base font-semibold">Trovati nelle tue schede</h2>
      <p className="mt-1 text-sm text-slate-400">
        Nomi letti dalle schede che hai già scritto. Tocca <strong>+</strong> per
        metterli in libreria, <strong>×</strong> per scartarli: quelli scartati
        non tornano più.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {items.map((s) => (
          <li
            key={s.name}
            className="inline-flex items-center overflow-hidden rounded-xl border border-line"
          >
            <span className="py-1.5 pl-3 pr-1 text-sm text-slate-200">{s.name}</span>
            {s.uses > 1 && (
              <span className="pr-1 text-[11px] text-slate-500">×{s.uses}</span>
            )}
            <button
              className="min-h-[36px] border-l border-line px-3 text-sm font-semibold text-accentSoft transition hover:bg-accent/10 disabled:opacity-40"
              onClick={() => void accept(s.name)}
              disabled={busy !== null}
              aria-label={`Aggiungi ${s.name} alla libreria`}
            >
              +
            </button>
            <button
              className="min-h-[36px] border-l border-line px-3 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-40"
              onClick={() => void reject(s.name)}
              disabled={busy !== null}
              aria-label={`Scarta ${s.name}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
