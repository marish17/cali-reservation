"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

export default function SessionBar() {
  const { session, loading } = useSession();
  if (loading || !session) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-xs">
      <span className="text-slate-400">{session.user.email}</span>
      <Link href="/le-mie-prenotazioni" className="text-accentSoft hover:underline">
        Le mie richieste
      </Link>
      <button
        className="ml-auto text-slate-400 hover:text-slate-200"
        onClick={() => void supabase.auth.signOut()}
      >
        Esci
      </button>
    </div>
  );
}
