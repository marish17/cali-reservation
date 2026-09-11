"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { addDays, ageAt, formatDayLong, formatDayShort, formatTime, toISODate } from "@/lib/date";
import type { Availability, PublicSettings } from "@/lib/types";

type Confirmation = {
  booking_id: string;
  cancel_token: string;
  day: string;
  start_time: string;
  end_time: string;
  coach_name: string;
  age: number;
  guardian_required: boolean;
};

type Form = {
  full_name: string;
  birth_date: string;
  email: string;
  phone: string;
  guardian_name: string;
  guardian_phone: string;
  notes: string;
};

const EMPTY_FORM: Form = {
  full_name: "",
  birth_date: "",
  email: "",
  phone: "",
  guardian_name: "",
  guardian_phone: "",
  notes: "",
};

export default function BookingFlow() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [settingsRes, availabilityRes] = await Promise.all([
      supabase.rpc("get_public_settings"),
      supabase.rpc("get_availability", {
        p_from: toISODate(new Date()),
        p_to: toISODate(addDays(new Date(), 120)),
      }),
    ]);

    if (settingsRes.error || availabilityRes.error) {
      setLoadError(
        "Non riusciamo a caricare i turni disponibili. Controlla la connessione e riprova."
      );
      setLoading(false);
      return;
    }

    setSettings((settingsRes.data as PublicSettings[])[0] ?? null);
    setAvailability((availabilityRes.data as Availability[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Giorni in cui esiste almeno una fascia con il coach presente.
  const days = useMemo(() => {
    const map = new Map<string, Availability[]>();
    for (const row of availability) {
      const list = map.get(row.day);
      if (list) list.push(row);
      else map.set(row.day, [row]);
    }
    return [...map.entries()]
      .map(([day, slots]) => ({
        day,
        slots,
        remaining: slots.reduce((sum, s) => sum + s.remaining, 0),
        dayRemaining: slots[0]?.day_remaining ?? 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [availability]);

  useEffect(() => {
    if (selectedDay || days.length === 0) return;
    setSelectedDay((days.find((d) => d.remaining > 0) ?? days[0]).day);
  }, [days, selectedDay]);

  const currentDay = days.find((d) => d.day === selectedDay) ?? null;
  const currentSlot = currentDay?.slots.find((s) => s.slot_id === selectedSlot) ?? null;

  // L'eta' che conta e' quella compiuta il giorno della prova.
  const age = currentSlot ? ageAt(form.birth_date, currentSlot.day) : null;
  const ageTooLow = age !== null && settings !== null && age < settings.min_age;
  const needsGuardian =
    age !== null && settings !== null && !ageTooLow && age < settings.guardian_required_under_age;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentSlot || !selectedDay) return;

    setSubmitting(true);
    setFormError(null);

    // Passiamo dal server: cosi' la notifica al coach parte anche se
    // l'utente chiude la pagina subito dopo l'invio.
    const response = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_id: currentSlot.slot_id,
        day: selectedDay,
        full_name: form.full_name,
        birth_date: form.birth_date,
        email: form.email,
        phone: form.phone,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        notes: form.notes || null,
      }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response) {
      setFormError("Connessione non riuscita. Controlla la rete e riprova.");
      return;
    }

    const result = (await response.json().catch(() => null)) as
      | { booking?: Confirmation; error?: string }
      | null;

    if (!response.ok || !result?.booking) {
      setFormError(result?.error ?? "Non è stato possibile completare la prenotazione.");
      // La disponibilita' potrebbe essere cambiata sotto i piedi.
      void load();
      setSelectedSlot(null);
      return;
    }

    setConfirmation(result.booking);
  }

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-4 h-20 rounded bg-white/5" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card border-red-500/40">
        <p className="text-sm text-red-200">{loadError}</p>
        <button className="btn-ghost mt-4" onClick={() => void load()}>
          Riprova
        </button>
      </div>
    );
  }

  if (confirmation) {
    return <Confirmed confirmation={confirmation} settings={settings} onReset={() => {
      setConfirmation(null);
      setForm(EMPTY_FORM);
      setSelectedSlot(null);
      void load();
    }} />;
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">1. Scegli il giorno</h2>
          {settings && (
            <span className="badge">
              max {settings.max_trials_per_day} prove al giorno
            </span>
          )}
        </header>

        {days.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Al momento non ci sono turni aperti alle prenotazioni. Riprova più tardi
            {settings?.contact_email ? ` o scrivi a ${settings.contact_email}` : ""}.
          </p>
        ) : (
          <div className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => {
              const isSelected = d.day === selectedDay;
              const soldOut = d.remaining === 0;
              return (
                <button
                  key={d.day}
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    setSelectedDay(d.day);
                    setSelectedSlot(null);
                    setFormError(null);
                  }}
                  className={[
                    "min-w-[104px] shrink-0 snap-start rounded-xl border px-3 py-3 text-left transition",
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-line bg-ink/40 hover:border-slate-500",
                    soldOut ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  <span className="block text-sm font-semibold">{formatDayShort(d.day)}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {soldOut ? "completo" : `${d.remaining} post${d.remaining === 1 ? "o" : "i"}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {currentDay && (
        <section className="card">
          <h2 className="text-lg font-semibold">2. Scegli l&apos;orario</h2>
          <p className="mt-1 text-sm text-slate-400">{formatDayLong(currentDay.day)}</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {currentDay.slots.map((slot) => {
              const isSelected = slot.slot_id === selectedSlot;
              const full = slot.remaining === 0;
              return (
                <button
                  key={slot.slot_id}
                  type="button"
                  disabled={full}
                  onClick={() => {
                    setSelectedSlot(slot.slot_id);
                    setFormError(null);
                  }}
                  className={[
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-line bg-ink/40 hover:border-slate-500",
                    full ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">{slot.coach_name}</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {full ? "completo" : `${slot.remaining} disp.`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {currentSlot && (
        <section className="card">
          <h2 className="text-lg font-semibold">3. I tuoi dati</h2>
          <p className="mt-1 text-sm text-slate-400">
            {formatDayLong(currentSlot.day)}, ore {formatTime(currentSlot.start_time)} con{" "}
            {currentSlot.coach_name}
          </p>

          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="full_name">
                Nome e cognome
              </label>
              <input
                id="full_name"
                className="field"
                required
                minLength={2}
                autoComplete="name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>


            <div className="sm:col-span-2">
              <label className="label" htmlFor="birth_date">
                Data di nascita
              </label>
              <input
                id="birth_date"
                type="date"
                className="field"
                required
                max={toISODate(new Date())}
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
              {age !== null && (
                <p
                  className={[
                    "mt-1.5 text-xs",
                    ageTooLow ? "text-red-300" : "text-slate-400",
                  ].join(" ")}
                >
                  {ageTooLow
                    ? `Per partecipare bisogna avere almeno ${settings?.min_age} anni.`
                    : `${age} anni il giorno della prova.`}
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="field"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="label" htmlFor="phone">
                Telefono
              </label>
              <input
                id="phone"
                type="tel"
                className="field"
                required
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>


            {needsGuardian && (
              <div className="sm:col-span-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-100">
                  Sotto i {settings?.guardian_required_under_age} anni la prova si svolge
                  accompagnati da un genitore o tutore, che deve essere presente in palestra.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="guardian_name">
                      Nome e cognome del genitore
                    </label>
                    <input
                      id="guardian_name"
                      className="field"
                      required
                      value={form.guardian_name}
                      onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="guardian_phone">
                      Telefono del genitore
                    </label>
                    <input
                      id="guardian_phone"
                      type="tel"
                      className="field"
                      required
                      value={form.guardian_phone}
                      onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">
                Note per il coach (facoltativo)
              </label>
              <textarea
                id="notes"
                className="field min-h-[84px] resize-y"
                maxLength={500}
                placeholder="Esperienza pregressa, infortuni, obiettivi..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {formError && (
              <p className="sm:col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {formError}
              </p>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="btn-primary w-full sm:w-auto"
                disabled={submitting || ageTooLow}
              >
                {submitting ? "Invio in corso..." : "Conferma la prenotazione"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function Confirmed({
  confirmation,
  settings,
  onReset,
}: {
  confirmation: Confirmation;
  settings: PublicSettings | null;
  onReset: () => void;
}) {
  const cancelUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/disdetta?token=${confirmation.cancel_token}`
      : `/disdetta?token=${confirmation.cancel_token}`;

  return (
    <div className="card border-accent/40">
      <span className="badge border-accent/50 text-accent">Prenotazione confermata</span>
      <h2 className="mt-4 text-2xl font-semibold">Ci vediamo in palestra!</h2>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-400">Giorno</dt>
          <dd className="font-medium">{formatDayLong(confirmation.day)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Orario</dt>
          <dd className="font-medium">
            {formatTime(confirmation.start_time)} – {formatTime(confirmation.end_time)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Coach</dt>
          <dd className="font-medium">{confirmation.coach_name}</dd>
        </div>
        {settings?.contact_phone && (
          <div>
            <dt className="text-slate-400">Contatti</dt>
            <dd className="font-medium">{settings.contact_phone}</dd>
          </div>
        )}
      </dl>

      {confirmation.guardian_required && (
        <p className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-100">
          Ricorda: il giorno della prova serve la presenza del genitore o tutore indicato.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-line bg-ink/50 p-4">
        <p className="text-sm text-slate-300">
          Salva questo link: ti serve per disdire la prova se non potessi venire.
        </p>
        <a className="mt-2 block break-all text-sm text-accent underline" href={cancelUrl}>
          {cancelUrl}
        </a>
      </div>

      <button className="btn-ghost mt-6" onClick={onReset}>
        Prenota un&apos;altra prova
      </button>
    </div>
  );
}
