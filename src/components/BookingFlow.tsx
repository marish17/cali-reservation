"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";
import { useSession } from "@/lib/useSession";
import Calendar from "@/components/Calendar";
import SignIn from "@/components/SignIn";
import { addDays, ageAt, formatDayLong, formatTime, toISODate } from "@/lib/date";
import type { Availability, PublicSettings } from "@/lib/types";

type Confirmation = {
  booking_id: string;
  day: string;
  start_time: string;
  end_time: string;
  guardian_required: boolean;
  status: string;
};

type Form = {
  full_name: string;
  birth_date: string;
  phone: string;
  guardian_name: string;
  guardian_phone: string;
  notes: string;
  privacy_accepted: boolean;
};

const EMPTY_FORM: Form = {
  full_name: "",
  birth_date: "",
  phone: "",
  guardian_name: "",
  guardian_phone: "",
  notes: "",
  privacy_accepted: false,
};

// La scelta fatta prima di accedere va ritrovata al ritorno dal link
// email, altrimenti si ricomincia da capo proprio dopo l'accesso.
const PENDING_KEY = "cali:pending-selection";

function savePending(day: string, slotId: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ day, slotId }));
  } catch {
    // Niente storage disponibile: si perde solo la comodita'.
  }
}

function readPending(): { day: string; slotId: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as { day: string; slotId: string }) : null;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignorato
  }
}

export default function BookingFlow() {
  const { session, loading: sessionLoading } = useSession();

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

  // Profilo gia' noto: il modulo parte compilato.
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, birth_date, phone, guardian_name, guardian_phone")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!data) return;
      setForm((current) => ({
        ...current,
        full_name: current.full_name || data.full_name || "",
        birth_date: current.birth_date || data.birth_date || "",
        phone: current.phone || data.phone || "",
        guardian_name: current.guardian_name || data.guardian_name || "",
        guardian_phone: current.guardian_phone || data.guardian_phone || "",
      }));
    })();
  }, [session]);

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
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [availability]);

  // Ritorno dal link di accesso: si riprende da dove si era rimasti.
  useEffect(() => {
    if (!session || selectedDay || days.length === 0) return;
    const pending = readPending();
    if (!pending) return;
    const day = days.find((d) => d.day === pending.day);
    if (!day) {
      clearPending();
      return;
    }
    setSelectedDay(pending.day);
    if (day.slots.some((s) => s.slot_id === pending.slotId && s.remaining > 0)) {
      setSelectedSlot(pending.slotId);
    }
    clearPending();
  }, [session, days, selectedDay]);

  useEffect(() => {
    if (selectedDay || days.length === 0) return;
    const firstFree = days.find((d) => d.remaining > 0);
    if (firstFree) setSelectedDay(firstFree.day);
  }, [days, selectedDay]);

  const currentDay = days.find((d) => d.day === selectedDay) ?? null;
  const currentSlot = currentDay?.slots.find((s) => s.slot_id === selectedSlot) ?? null;

  // Il coach non e' una scelta dell'utente: due coach nella stessa
  // fascia sono un orario solo.
  const timeSlots = useMemo(() => {
    if (!currentDay) return [];
    const map = new Map<
      string,
      { key: string; start_time: string; end_time: string; remaining: number; slot_id: string | null }
    >();

    for (const slot of currentDay.slots) {
      const key = `${slot.start_time}-${slot.end_time}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          start_time: slot.start_time,
          end_time: slot.end_time,
          remaining: slot.remaining,
          slot_id: slot.remaining > 0 ? slot.slot_id : null,
        });
        continue;
      }
      existing.remaining += slot.remaining;
      if (!existing.slot_id && slot.remaining > 0) existing.slot_id = slot.slot_id;
    }

    return [...map.values()].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [currentDay]);

  const age = currentSlot ? ageAt(form.birth_date, currentSlot.day) : null;
  const ageTooLow = age !== null && settings !== null && age < settings.min_age;
  const needsGuardian =
    age !== null && settings !== null && !ageTooLow && age < settings.guardian_required_under_age;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!currentSlot || !selectedDay || !session) return;

    setSubmitting(true);
    setFormError(null);

    const { data, error } = await supabase.rpc("request_trial", {
      p_slot_id: currentSlot.slot_id,
      p_day: selectedDay,
      p_full_name: form.full_name,
      p_birth_date: form.birth_date,
      p_phone: form.phone,
      p_privacy_accepted: form.privacy_accepted,
      p_guardian_name: form.guardian_name || null,
      p_guardian_phone: form.guardian_phone || null,
      p_notes: form.notes || null,
    });

    setSubmitting(false);

    if (error) {
      setFormError(bookingErrorMessage(error));
      // La disponibilita' potrebbe essere cambiata sotto i piedi.
      void load();
      setSelectedSlot(null);
      return;
    }

    const booking = ((data as Confirmation[]) ?? [])[0];
    if (!booking) {
      setFormError("Non è stato possibile inviare la richiesta.");
      return;
    }

    setConfirmation(booking);
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
    return (
      <div className="card border-accent/45">
        <span className="badge border-accent/60 text-accentSoft">Richiesta inviata</span>
        <h2 className="mt-4 text-2xl font-semibold">Ci siamo quasi</h2>
        <p className="mt-2 text-sm text-slate-300">
          Il coach deve confermare la disponibilità per questo orario. Il posto resta tenuto
          da parte fino ad allora. Rientra qui e apri <strong>Le mie richieste</strong>: appena
          risponde, accanto alla voce compare il numero delle novità.
        </p>

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
        </dl>

        {confirmation.guardian_required && (
          <p className="mt-5 rounded-xl border border-accent/45 bg-accent/[0.07] p-4 text-sm text-slate-200">
            Ricorda: il giorno della prova serve la presenza del genitore o tutore indicato.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/le-mie-prenotazioni" className="btn-primary">
            Vedi le tue richieste
          </Link>
          <button
            className="btn-ghost"
            onClick={() => {
              setConfirmation(null);
              setSelectedSlot(null);
              void load();
            }}
          >
            Chiedi un&apos;altra data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-lg font-semibold">1. Scegli il giorno</h2>

        {days.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            Al momento non ci sono turni aperti alle prenotazioni. Riprova più tardi
            {settings?.contact_email ? ` o scrivi a ${settings.contact_email}` : ""}.
          </p>
        ) : (
          <div className="mt-4">
            <Calendar
              days={days.map((d) => ({ day: d.day, remaining: d.remaining }))}
              selectedDay={selectedDay}
              horizonDays={settings?.booking_horizon_days ?? 30}
              onSelect={(day) => {
                setSelectedDay(day);
                setSelectedSlot(null);
                setFormError(null);
              }}
            />
          </div>
        )}
      </section>

      {currentDay && (
        <section className="card">
          <h2 className="text-lg font-semibold">2. Scegli l&apos;orario</h2>
          <p className="mt-1 text-sm text-slate-400">{formatDayLong(currentDay.day)}</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {timeSlots.map((slot) => {
              const full = slot.remaining === 0 || !slot.slot_id;
              const isSelected = !full && slot.slot_id === selectedSlot;
              return (
                <button
                  key={slot.key}
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
                  <span className="text-sm font-semibold">
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {full ? "completo" : "disponibile"}
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
            {formatDayLong(currentSlot.day)}, ore {formatTime(currentSlot.start_time)} –{" "}
            {formatTime(currentSlot.end_time)}
          </p>

          {sessionLoading ? (
            <p className="mt-4 text-sm text-slate-400">Un attimo…</p>
          ) : !session ? (
            <div className="mt-4">
              <SignIn
                title="Serve un account per richiedere la prova"
                description="Bastano email e password. Ci servono per confermarti l'orario e per farti seguire la richiesta."
                onBeforeSubmit={() => savePending(currentSlot.day, currentSlot.slot_id)}
              />
            </div>
          ) : (
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

              <div className="sm:col-span-2">
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
                <div className="sm:col-span-2 rounded-xl border border-accent/45 bg-accent/[0.07] p-4">
                  <p className="text-sm text-slate-200">
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

              <div className="sm:col-span-2 rounded-xl border border-line bg-ink/40 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                    checked={form.privacy_accepted}
                    onChange={(e) =>
                      setForm({ ...form, privacy_accepted: e.target.checked })
                    }
                  />
                  <span className="text-sm text-slate-300">
                    Ho letto l&apos;
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="text-accentSoft underline"
                    >
                      informativa privacy
                    </a>{" "}
                    e acconsento al trattamento dei dati per gestire questa richiesta.
                    {needsGuardian && (
                      <span className="mt-1.5 block text-xs text-slate-400">
                        Trattandosi di un minore, il consenso è prestato dal genitore o da chi
                        ne fa le veci.
                      </span>
                    )}
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto"
                  disabled={submitting || ageTooLow || !form.privacy_accepted}
                >
                  {submitting ? "Invio in corso…" : "Invia la richiesta"}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  La prova è confermata solo dopo l&apos;approvazione del coach.
                </p>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
