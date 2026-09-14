"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useCount } from "@/lib/useCount";
import CountBadge from "@/components/CountBadge";

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

        <Link
          href="/le-mie-prenotazioni"
          className="ml-auto inline-flex min-h-[38px] shrink-0 items-center rounded-xl border border-line px-3 text-xs font-medium text-slate-200 transition active:scale-[0.98] hover:border-slate-500 hover:bg-white/5"
        >
          <span className="hidden xs:inline">Le mie richieste</span>
          <span className="xs:hidden">Richieste</span>
          {session && <MyUpdatesBadge />}
        </Link>
      </div>

      {session && (
        <div className="flex items-center gap-3 border-t border-line/60 py-2 text-[11px] text-slate-500">
          <span className="truncate">{session.user.email}</span>
          <Link href="/admin" className="ml-auto shrink-0 hover:text-slate-300">
            Area coach
          </Link>
          <button
            className="shrink-0 hover:text-slate-300"
            onClick={() => void supabase.auth.signOut()}
          >
            Esci
          </button>
        </div>
      )}
    </div>
  );
}

/** Quante risposte del coach la persona non ha ancora visto. */
function MyUpdatesBadge() {
  const { count } = useCount("my_updates_count");
  return <CountBadge count={count} />;
}
