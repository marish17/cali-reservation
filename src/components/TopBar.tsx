"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

/**
 * Barra di servizio in cima alla pagina. In fondo, da telefono,
 * questi collegamenti restavano sotto un modulo lungo e di fatto
 * irraggiungibili.
 */
export default function TopBar({ gymName }: { gymName: string }) {
  const { session } = useSession();

  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo size={38} />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accentSoft">
          {gymName}
        </span>
      </Link>

      <nav className="ml-auto flex items-center gap-2 text-xs">
        <Link
          href="/le-mie-prenotazioni"
          className="rounded-lg border border-line px-3 py-1.5 text-slate-200 transition hover:border-slate-500 hover:bg-white/5"
        >
          Le mie richieste
        </Link>
        <Link
          href="/admin"
          className="rounded-lg border border-line px-3 py-1.5 text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
        >
          Area coach
        </Link>
      </nav>

      {session && (
        <div className="flex w-full items-center gap-3 text-xs text-slate-500">
          <span className="truncate">{session.user.email}</span>
          <button
            className="ml-auto shrink-0 hover:text-slate-300"
            onClick={() => void supabase.auth.signOut()}
          >
            Esci
          </button>
        </div>
      )}
    </div>
  );
}
