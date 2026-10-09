"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * La scheda si vede in un posto solo: la pagina iniziale.
 *
 * Per un po' sono esistite due pagine diverse che mostravano la stessa
 * cosa — una aprendo l'app, una toccando «Scheda» nel menu — con
 * intestazioni e contorni diversi. Qualunque fosse la migliore, averne
 * due era il difetto. Questo indirizzo resta solo per i collegamenti
 * già in giro, e rimanda là.
 */
export default function SchedaRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <p className="mx-auto max-w-md px-4 py-20 text-sm text-slate-400">Un attimo…</p>;
}
