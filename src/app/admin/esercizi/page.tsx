"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import type { Exercise, ExerciseUnit } from "@/lib/types";
import { UNIT_LABEL, UNITS } from "@/lib/types";

export default function AdminExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<ExerciseUnit>("reps");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("active", { ascending: false })
      .order("name");
    if (error) setError(bookingErrorMessage(error));
    else setItems((data as Exercise[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("exercises")
      .insert({ name: trimmed, unit, category: category.trim() || null });
    if (error) {
      setError(
        error.code === "23505"
          ? "Questo esercizio c'è già."
          : bookingErrorMessage(error)
      );
      return;
    }
    setName("");
    setCategory("");
    void load();
  }

  async function toggle(item: Exercise) {
    await supabase.from("exercises").update({ active: !item.active }).eq("id", item.id);
    void load();
  }

  const active = items.filter((e) => e.active);
  const retired = items.filter((e) => !e.active);

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-base font-semibold">Esercizi</h2>
        <p className="mt-1 text-sm text-slate-400">
          Servono alle valutazioni. Sei trazioni a marzo e nove a giugno si
          confrontano solo se sono lo stesso esercizio, non due righe scritte
          a mano in modo diverso.
        </p>

        <form className="mt-4 space-y-3" onSubmit={add}>
          <div>
            <label className="label" htmlFor="ex-name">
              Nome
            </label>
            <input
              id="ex-name"
              className="field"
              placeholder="Trazioni alla sbarra"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ex-unit">
                Come si misura
              </label>
              <select
                id="ex-unit"
                className="field"
                value={unit}
                onChange={(e) => setUnit(e.target.value as ExerciseUnit)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ex-cat">
                Gruppo (facoltativo)
              </label>
              <input
                id="ex-cat"
                className="field"
                placeholder="Tirata, spinta, core…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="action-bar">
            <button className="btn-primary w-full sm:w-auto" type="submit" disabled={!name.trim()}>
              Aggiungi
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
      </section>

      <section className="card">
        <h2 className="text-base font-semibold">In uso ({active.length})</h2>
        {loading && <p className="mt-3 text-sm text-slate-400">Caricamento…</p>}
        {!loading && active.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">
            Ancora nessun esercizio. Aggiungi quelli che misuri davvero: tre o
            quattro bastano per cominciare.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {active.map((item) => (
            <ExerciseRow key={item.id} item={item} onToggle={() => void toggle(item)} />
          ))}
        </ul>
      </section>

      {retired.length > 0 && (
        <section className="card">
          <h2 className="text-base font-semibold">Ritirati ({retired.length})</h2>
          <p className="mt-1 text-sm text-slate-400">
            Non compaiono più nelle nuove valutazioni, ma restano in quelle
            già fatte.
          </p>
          <ul className="mt-3 space-y-2">
            {retired.map((item) => (
              <ExerciseRow key={item.id} item={item} onToggle={() => void toggle(item)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ExerciseRow({ item, onToggle }: { item: Exercise; onToggle: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-ink/40 px-3 py-2.5 text-sm">
      <span className="font-medium">{item.name}</span>
      <span className="badge">{UNIT_LABEL[item.unit]}</span>
      {item.category && <span className="text-xs text-slate-400">{item.category}</span>}
      <button className="btn-ghost ml-auto !min-h-[34px] !px-2.5 text-xs" onClick={onToggle}>
        {item.active ? "Ritira" : "Rimetti in uso"}
      </button>
    </li>
  );
}
