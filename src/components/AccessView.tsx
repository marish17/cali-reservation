"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import SignIn from "@/components/SignIn";
import { useSession } from "@/lib/useSession";

/**
 * Una pagina con un indirizzo suo, non un pannello che si apre: così
 * il link si può mandare agli allievi in un messaggio.
 *
 * Chi arriva qui un account quasi sempre ce l'ha — il modulo parte
 * dall'accesso, non dalla registrazione. Chi non ce l'ha lo crea
 * durante la prenotazione, dove il verso giusto è l'opposto.
 */
export default function AccessView() {
  const router = useRouter();
  const { session, loading } = useSession();

  // Entrato, si torna alla pagina iniziale, che decide da sola cosa
  // mostrare: la scheda, lo stato della richiesta o il calendario.
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Logo size={36} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accentSoft">
          Calisthenics Academy
        </span>
      </Link>

      <h1 className="text-2xl font-bold">Accedi</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Dentro trovi la tua scheda, se ne hai una, e lo stato delle tue
        richieste.
      </p>

      <div className="card mt-6">
        {loading || session ? (
          <p className="text-sm text-slate-400">Un attimo…</p>
        ) : (
          <SignIn
            initialMode="signin"
            title="Entra nel tuo account"
            description="Se non hai ancora un account, qui sotto puoi crearne uno: non serve prenotare una prova."
          />
        )}
      </div>

      {/* Due strade diverse, dette tutte e due. Chi si allena già da noi
          non deve prenotare una prova che non gli serve solo per avere
          un account. */}
      <div className="mt-6 space-y-2 text-sm text-slate-400">
        <p>
          <strong className="font-medium text-slate-300">
            Ti alleni già da noi?
          </strong>{" "}
          Crea l&apos;account qui sopra con «Non ho un account»: il tuo coach ti
          assegnerà la scheda.
        </p>
        <p>
          <strong className="font-medium text-slate-300">
            Non ci sei mai stato?
          </strong>{" "}
          <Link href="/" className="text-accentSoft underline underline-offset-4">
            Prenota una prova gratuita
          </Link>
          : l&apos;account si crea durante la prenotazione.
        </p>
      </div>
    </main>
  );
}
