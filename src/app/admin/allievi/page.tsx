"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import PersonDetail from "@/components/PersonDetail";
import { formatDayLong } from "@/lib/date";
import type { Coach, Person } from "@/lib/types";

export default function AdminPeoplePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Caricamento…</p>}>
      <People />
    </Suspense>
  );
}

function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [query, setQuery] = useState("");
  const [onlyStudents, setOnlyStudents] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.rpc("list_people"),
      supabase.from("coaches").select("*").eq("active", true).order("name"),
    ]);
    if (p.error) setError("Errore nel caricamento delle persone.");
    else setPeople((p.data as Person[]) ?? []);
    setCoaches((c.data as Coach[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => {
      if (!showArchived && !p.active) return false;
      if (onlyStudents && !p.is_student) return false;
      if (!q) return true;
      return `${p.display_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q);
    });
  }, [people, query, onlyStudents, showArchived]);

  const archived = people.filter((p) => !p.active).length;

  const current = people.find((p) => p.user_id === selected) ?? null;

  // Da telefono la scheda della persona prende tutto lo schermo: due
  // colonne su 360px non si leggono.
  if (current) {
    return (
      <PersonDetail
        person={current}
        coaches={coaches}
        onBack={() => setSelected(null)}
        onChanged={load}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-base font-semibold">Persone</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tutti quelli che hanno un account. Diventano allievi quando compili
          il questionario o assegni una scheda.
        </p>

        <input
          className="field mt-4"
          type="search"
          placeholder="Cerca per nome o email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-accent"
            checked={onlyStudents}
            onChange={(e) => setOnlyStudents(e.target.checked)}
          />
          Solo allievi
        </label>

        {archived > 0 && (
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-accent"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Mostra anche gli archiviati ({archived})
          </label>
        )}
      </section>

      {error && <p className="text-sm text-red-200">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Caricamento…</p>}

      {!loading && visible.length === 0 && (
        <p className="card text-sm text-slate-400">Nessuno corrisponde alla ricerca.</p>
      )}

      <ul className="space-y-2">
        {visible.map((p) => {
          const coach = coaches.find((c) => c.id === p.coach_id);
          return (
            <li key={p.user_id}>
              <button
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface/70 px-3 py-3 text-left transition hover:border-slate-500 hover:bg-white/5"
                onClick={() => setSelected(p.user_id)}
              >
                <Avatar name={p.display_name} email={p.email} path={p.avatar_path} size={40} />
                <span className="min-w-0 flex-1">
                  {/* Il nome per primo e in grande: è così che il coach
                      cerca una persona, non per indirizzo email. */}
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold">
                      {p.display_name || p.email || "Senza nome"}
                    </span>
                    {p.enrolled && (
                      <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accentSoft">
                        iscritto
                      </span>
                    )}
                    {!p.active && (
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                        archiviato
                      </span>
                    )}
                  </span>
                  {p.display_name && p.email && (
                    <span className="block truncate text-xs text-slate-500">{p.email}</span>
                  )}
                  <span className="block truncate text-xs text-slate-400">
                    {p.intake_updated_at
                      ? `Questionario del ${formatDayLong(p.intake_updated_at.slice(0, 10))}`
                      : p.last_booking
                        ? `Ultima prova ${formatDayLong(p.last_booking)}`
                        : "Nessuna prova"}
                    {coach && ` · ${coach.name}`}
                  </span>
                </span>
                <span className="text-slate-500" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
