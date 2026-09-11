"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { WEEKDAYS } from "@/lib/date";
import { formatTime } from "@/lib/date";
import type { Coach, WeeklySlot } from "@/lib/types";

export default function AdminSchedulePage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [slots, setSlots] = useState<WeeklySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCoach, setNewCoach] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [coachRes, slotRes] = await Promise.all([
      supabase.from("coaches").select("*").order("name"),
      supabase.from("weekly_slots").select("*").order("weekday").order("start_time"),
    ]);
    if (coachRes.error || slotRes.error) setError("Errore nel caricamento degli orari.");
    else {
      setCoaches((coachRes.data as Coach[]) ?? []);
      setSlots((slotRes.data as WeeklySlot[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCoach(event: React.FormEvent) {
    event.preventDefault();
    const name = newCoach.trim();
    if (!name) return;
    const { error } = await supabase.from("coaches").insert({ name });
    if (error) setError("Non è stato possibile aggiungere il coach.");
    else {
      setNewCoach("");
      void load();
    }
  }

  async function toggleCoach(coach: Coach) {
    await supabase.from("coaches").update({ active: !coach.active }).eq("id", coach.id);
    void load();
  }

  async function removeCoach(coach: Coach) {
    if (!confirm(`Eliminare ${coach.name} e tutte le sue fasce orarie?`)) return;
    const { error } = await supabase.from("coaches").delete().eq("id", coach.id);
    if (error) {
      setError(
        "Impossibile eliminare: esistono prenotazioni collegate. Disattiva il coach invece di eliminarlo."
      );
    } else void load();
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-base font-semibold">Aggiungi un coach</h2>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={addCoach}>
          <input
            className="field flex-1 min-w-[200px]"
            placeholder="Nome del coach"
            value={newCoach}
            onChange={(e) => setNewCoach(e.target.value)}
          />
          <button className="btn-primary" type="submit">
            Aggiungi
          </button>
        </form>
      </section>

      {error && <p className="card border-red-500/40 text-sm text-red-200">{error}</p>}
      {loading && <p className="card text-sm text-slate-400">Caricamento…</p>}

      {coaches.map((coach) => (
        <CoachCard
          key={coach.id}
          coach={coach}
          slots={slots.filter((s) => s.coach_id === coach.id)}
          onChanged={load}
          onToggle={() => void toggleCoach(coach)}
          onRemove={() => void removeCoach(coach)}
        />
      ))}

      {!loading && coaches.length === 0 && (
        <p className="card text-sm text-slate-400">
          Nessun coach ancora. Aggiungine uno per iniziare a definire gli orari.
        </p>
      )}
    </div>
  );
}

function CoachCard({
  coach,
  slots,
  onChanged,
  onToggle,
  onRemove,
}: {
  coach: Coach;
  slots: WeeklySlot[];
  onChanged: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:00");
  const [capacity, setCapacity] = useState(2);
  const [error, setError] = useState<string | null>(null);

  async function addSlot(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (end <= start) {
      setError("L'orario di fine deve essere successivo a quello di inizio.");
      return;
    }
    const { error } = await supabase.from("weekly_slots").insert({
      coach_id: coach.id,
      weekday,
      start_time: start,
      end_time: end,
      capacity,
    });
    if (error) setError("Questa fascia esiste già per il coach in quel giorno.");
    else onChanged();
  }

  async function removeSlot(id: string) {
    const { error } = await supabase.from("weekly_slots").delete().eq("id", id);
    if (error) {
      setError(
        "Impossibile eliminare: la fascia ha prenotazioni collegate. Disattivala invece di eliminarla."
      );
    } else onChanged();
  }

  async function toggleSlot(slot: WeeklySlot) {
    await supabase.from("weekly_slots").update({ active: !slot.active }).eq("id", slot.id);
    onChanged();
  }

  async function updateCapacity(slot: WeeklySlot, value: number) {
    await supabase.from("weekly_slots").update({ capacity: value }).eq("id", slot.id);
    onChanged();
  }

  return (
    <section className="card">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold">{coach.name}</h3>
        {!coach.active && <span className="badge">non attivo</span>}
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={onToggle}>
            {coach.active ? "Disattiva" : "Attiva"}
          </button>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={onRemove}>
            Elimina
          </button>
        </div>
      </header>

      <div className="mt-4 space-y-2">
        {slots.length === 0 && (
          <p className="text-sm text-slate-400">Nessuna fascia oraria impostata.</p>
        )}
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={[
              "flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink/40 px-3 py-2 text-sm",
              slot.active ? "" : "opacity-50",
            ].join(" ")}
          >
            <span className="w-24 font-medium">{WEEKDAYS[slot.weekday]}</span>
            <span className="text-slate-300">
              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
            </span>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              posti
              <input
                type="number"
                min={0}
                max={50}
                defaultValue={slot.capacity}
                className="field !w-16 !px-2 !py-1"
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (value !== slot.capacity && Number.isFinite(value) && value >= 0) {
                    void updateCapacity(slot, value);
                  }
                }}
              />
            </label>
            <div className="ml-auto flex gap-2">
              <button
                className="btn-ghost !px-2.5 !py-1 text-xs"
                onClick={() => void toggleSlot(slot)}
              >
                {slot.active ? "Sospendi" : "Riattiva"}
              </button>
              <button
                className="btn-ghost !px-2.5 !py-1 text-xs"
                onClick={() => void removeSlot(slot.id)}
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4" onSubmit={addSlot}>
        <div>
          <label className="label">Giorno</label>
          <select
            className="field !w-auto"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {WEEKDAYS.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dalle</label>
          <input
            type="time"
            className="field !w-auto"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Alle</label>
          <input
            type="time"
            className="field !w-auto"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Posti</label>
          <input
            type="number"
            min={0}
            max={50}
            className="field !w-20"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </div>
        <button className="btn-primary" type="submit">
          Aggiungi fascia
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}
