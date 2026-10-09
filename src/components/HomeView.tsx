"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import BookingFlow from "@/components/BookingFlow";
import CoachHours from "@/components/CoachHours";
import InstallHint from "@/components/InstallHint";
import MyBookings from "@/components/MyBookings";
import MyWorkout from "@/components/MyWorkout";
import SetupNotice from "@/components/SetupNotice";
import TopBar from "@/components/TopBar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { toISODate } from "@/lib/date";
import type { Membership, PublicSettings } from "@/lib/types";

type View = "scheda" | "richieste" | "prenota";

/**
 * I testi arrivano dal database mentre la pagina è già a schermo: il
 * sito resta un pacchetto di file statici, senza un server acceso a
 * ricostruirlo a ogni visita.
 *
 * Quello che si vede aprendo il sito dipende da chi sei. Chi si allena
 * già vuole la sua scheda, chi ha una prova in sospeso vuole sapere
 * com'è andata, chi non ha nulla vuole prenotare. Mostrare a tutti il
 * calendario significa dare torto a due su tre.
 */
export default function HomeView() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const { session, loading: sessionLoading } = useSession();
  const [view, setView] = useState<View | null>(null);
  const [has, setHas] = useState<{ workout: boolean; bookings: boolean }>({
    workout: false,
    bookings: false,
  });
  // Chi si registra senza prenotare non passa dal modulo che chiede il
  // nome: al coach arriverebbe un indirizzo email e basta.
  const [needsName, setNeedsName] = useState(false);
  // Chi si è registrato prima che il numero fosse obbligatorio non va
  // bloccato, ma glielo si può chiedere.
  const [needsPhone, setNeedsPhone] = useState(false);
  const [me, setMe] = useState<Membership | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void (async () => {
      const { data } = await supabase.rpc("get_public_settings");
      setSettings(((data as PublicSettings[]) ?? [])[0] ?? null);
    })();
  }, []);

  const decide = useCallback(async () => {
    if (!session) {
      setView("prenota");
      setHas({ workout: false, bookings: false });
      setNeedsName(false);
      setNeedsPhone(false);
      setMe(null);
      setIsAdmin(false);
      return;
    }

    const [w, b, p, m, a] = await Promise.all([
      supabase.rpc("get_my_workout"),
      supabase
        .from("bookings")
        .select("id, status, day")
        .gte("day", toISODate(new Date()))
        .in("status", ["pending", "approved"]),
      supabase.rpc("get_my_profile"),
      supabase.rpc("get_my_membership"),
      supabase.rpc("is_admin"),
    ]);

    const workout = ((w.data as unknown[]) ?? []).length > 0;
    const bookings = ((b.data as unknown[]) ?? []).length > 0;
    const profile = ((p.data as { display_name: string | null; phone: string | null }[]) ?? [])[0];
    const membership = ((m.data as Membership[]) ?? [])[0] ?? null;
    setNeedsName(!profile?.display_name?.trim());
    setNeedsPhone(!profile?.phone?.trim());
    setMe(membership);
    setIsAdmin(Boolean(a.data));
    setHas({ workout, bookings });

    // Chi è iscritto la prova non la fa: il calendario e le richieste
    // non esistono proprio per lui.
    if (membership?.enrolled) {
      setView("scheda");
      return;
    }
    setView(workout ? "scheda" : bookings ? "richieste" : "prenota");
  }, [session]);

  useEffect(() => {
    if (sessionLoading) return;
    void decide();
  }, [sessionLoading, decide]);

  const gymName = settings?.gym_name ?? "Calisthenics Academy";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-3 sm:pb-16 sm:pt-6">
      <TopBar gymName={gymName} hideRequests={me?.enrolled ?? false} />

      {!isSupabaseConfigured ? (
        <SetupNotice />
      ) : view === null ? (
        <p className="text-sm text-slate-400">Caricamento…</p>
      ) : (
        <>
          {view === "prenota" && (
            <header className="mb-6 sm:mb-8">
              <h1 className="text-[26px] font-bold leading-[1.15] sm:text-4xl">
                Prenota la tua prova gratuita
              </h1>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-400">
                {settings?.intro_text ??
                  "Scegli il giorno e l'orario in cui il coach è presente. Bastano trenta secondi."}
              </p>
              {/* La parola "scheda" deve comparire prima che uno la debba
                  indovinare: è quello che cerca chi si allena già. */}
              {!session && (
                <p className="mt-3 text-sm text-slate-400">
                  Ti alleni già da noi?{" "}
                  <Link
                    href="/accedi"
                    className="text-accentSoft underline underline-offset-4"
                  >
                    Accedi per vedere la tua scheda
                  </Link>
                  .
                </p>
              )}
            </header>
          )}

          {/* Una password messa dal coach la conosce anche il coach:
              finché resta, l'avviso resta. */}
          {me?.password_reset_at && (
            <section className="card mb-5 border-accent/45">
              <h2 className="text-base font-semibold text-white">Cambia la password</h2>
              <p className="mt-1.5 text-sm text-slate-300">
                Quella che stai usando te l&apos;ha data un coach, quindi la
                conosce anche lui. Scegline una tua.
              </p>
              <Link href="/profilo" className="btn-primary mt-3">
                Cambia la password
              </Link>
            </section>
          )}

          {/* Manca un recapito: non si blocca nessuno, lo si chiede. */}
          {session && !needsName && needsPhone && (
            <section className="card mb-5">
              <h2 className="text-base font-semibold text-white">Lasciaci un numero</h2>
              <p className="mt-1.5 text-sm text-slate-300">
                Serve al tuo coach per avvisarti se un allenamento salta o se
                cambia qualcosa. Ci vuole un minuto.
              </p>
              <Link href="/profilo" className="btn-primary mt-3">
                Aggiungi il cellulare
              </Link>
            </section>
          )}

          {/* Iscritto e senza scheda: non è un equivoco da spiegare, è
              solo una scheda che il coach non ha ancora scritto. */}
          {me?.enrolled && !has.workout && (
            <section className="card mb-5">
              <h2 className="text-base font-semibold text-white">
                La tua scheda non è ancora pronta
              </h2>
              <p className="mt-1.5 text-sm text-slate-300">
                {me.coach_name
                  ? `Te la scrive ${me.coach_name}: la trovi qui appena è pronta.`
                  : "Te la scrive il tuo coach: la trovi qui appena è pronta."}
              </p>
            </section>
          )}

          {/* Registrato, ma senza scheda e senza prove: è chi si allena
              già da noi e si è fatto l'account per i servizi. Mandarlo
              dritto al calendario delle prove sarebbe un equivoco. */}
          {session && !me?.enrolled && view === "prenota" && !has.workout && !has.bookings && (
            <section className="card mb-5 border-accent/35">
              <h2 className="text-base font-semibold text-white">
                Non hai ancora una scheda
              </h2>
              <p className="mt-1.5 text-sm text-slate-300">
                Se ti alleni già da noi, te la assegna il tuo coach: la trovi
                qui appena è pronta. Se invece non ci sei mai stato, prenota
                una prova qui sotto.
              </p>
              {needsName && (
                <>
                  <p className="mt-3 text-sm text-slate-400">
                    Intanto dicci come ti chiami{needsPhone && " e lasciaci un numero"},
                    altrimenti il coach vede solo il tuo indirizzo email e non
                    sa chi sei.
                  </p>
                  <Link href="/profilo" className="btn-primary mt-3">
                    Completa il profilo
                  </Link>
                </>
              )}
            </section>
          )}

          {view === "prenota" && <InstallHint />}

          {/* Le altre sezioni restano raggiungibili: la scelta di
              partenza è un'ipotesi, non una gabbia. Per chi è iscritto
              invece non è un'ipotesi: le prove non lo riguardano. */}
          {session && !me?.enrolled && (has.workout || has.bookings) && (
            <nav className="mb-5 flex gap-2">
              {has.workout && (
                <Tab label="Scheda" on={view === "scheda"} onClick={() => setView("scheda")} />
              )}
              <Tab label="Richieste" on={view === "richieste"} onClick={() => setView("richieste")} />
              <Tab label="Prenota" on={view === "prenota"} onClick={() => setView("prenota")} />
            </nav>
          )}

          {view === "scheda" && (
            <MyWorkout
              // Un iscritto senza scheda resta dov'è: il calendario
              // delle prove per lui non è un ripiego, è un errore.
              onEmpty={
                me?.enrolled
                  ? undefined
                  : () => setView(has.bookings ? "richieste" : "prenota")
              }
            />
          )}
          {view === "richieste" && <MyBookings />}
          {view === "prenota" && <BookingFlow />}

          {me?.enrolled && (
            <div className="mt-4 space-y-4">
              <CoachHours />

            </div>
          )}
        </>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-slate-500">
        {(settings?.contact_email || settings?.contact_phone) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 py-2">
            {settings?.contact_email && <span>{settings.contact_email}</span>}
            {settings?.contact_phone && <span>{settings.contact_phone}</span>}
          </div>
        )}
        <div className="flex items-center justify-between">
          <a className="inline-flex min-h-[40px] items-center hover:text-slate-300" href="/privacy">
            Informativa privacy
          </a>
          {/* Da sloggati resta: è da lì che i coach raggiungono il loro
              accesso. Da dentro, solo a chi le chiavi ce l'ha davvero. */}
          {(!session || isAdmin) && (
            <a className="inline-flex min-h-[40px] items-center hover:text-slate-300" href="/admin">
              Area coach
            </a>
          )}
        </div>
      </footer>
    </main>
  );
}

function Tab({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={[
        "min-h-[42px] flex-1 truncate rounded-xl border px-2.5 text-sm transition active:scale-[0.98]",
        on
          ? "border-accent/50 bg-accent/12 font-semibold text-accentSoft"
          : "border-line text-slate-300 hover:bg-white/5",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
