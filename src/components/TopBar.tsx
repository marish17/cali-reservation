"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useCount } from "@/lib/useCount";
import CountBadge from "@/components/CountBadge";
import Avatar from "@/components/Avatar";

/**
 * Barra di servizio, ancorata in cima. Da telefono resta visibile
 * mentre si scorre il modulo: è l'unico punto da cui si raggiungono le
 * proprie richieste, e in fondo alla pagina non lo troverebbe nessuno.
 */
export default function TopBar({ gymName }: { gymName: string }) {
  const { session } = useSession();

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-line bg-ink/90 px-4 backdrop-blur-md sm:mb-8">
      <div className="flex items-center gap-3 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo size={36} />
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-accentSoft sm:text-xs">
            {gymName}
          </span>
        </Link>

        {/* Sloggato il bottone dice l'azione, non la destinazione: chi
            non è ancora entrato non ha "richieste" e quella parola non
            gli dice dove andare. */}
        {session ? (
          <Link
            href="/le-mie-prenotazioni"
            className="ml-auto inline-flex min-h-[38px] shrink-0 items-center rounded-xl border border-line px-3 text-xs font-medium text-slate-200 transition active:scale-[0.98] hover:border-slate-500 hover:bg-white/5"
          >
            <span className="hidden xs:inline">Le mie richieste</span>
            <span className="xs:hidden">Richieste</span>
            <MyUpdatesBadge />
          </Link>
        ) : (
          // Bordato e non rosso: chi arriva nuovo deve sentire come
          // azione principale la prenotazione, non l'accesso. La parola
          // giusta basta a farsi trovare da chi cerca la sua scheda.
          <Link
            href="/accedi"
            className="ml-auto inline-flex min-h-[38px] shrink-0 items-center rounded-xl border border-line px-4 text-xs font-medium text-slate-200 transition active:scale-[0.98] hover:border-slate-500 hover:bg-white/5"
          >
            Accedi
          </Link>
        )}
      </div>

      {session && <SessionRow email={session.user.email ?? null} />}
    </div>
  );
}

/** Quante risposte del coach la persona non ha ancora visto. */
function MyUpdatesBadge() {
  const { count } = useCount("my_updates_count");
  return <CountBadge count={count} />;
}

/** Chi sei, con nome e foto invece dell'indirizzo email. */
function SessionRow({ email }: { email: string | null }) {
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_path: string | null } | null>(
    null
  );

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_my_profile");
      setProfile(((data as typeof profile[]) ?? [])[0] ?? null);
    })();
  }, []);

  return (
    <div className="flex items-center gap-2 border-t border-line/60 py-2 text-[11px] text-slate-500">
      <Link href="/profilo" className="flex min-w-0 items-center gap-2 hover:text-slate-300">
        <Avatar name={profile?.display_name} email={email} path={profile?.avatar_path} size={22} />
        <span className="truncate">{profile?.display_name || email}</span>
      </Link>
      <Link href="/admin" className="ml-auto shrink-0 hover:text-slate-300">
        Area coach
      </Link>
      <button className="shrink-0 hover:text-slate-300" onClick={() => void supabase.auth.signOut()}>
        Esci
      </button>
    </div>
  );
}
