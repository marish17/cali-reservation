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
        Con l&apos;email e la password che hai usato per prenotare. Dentro
        trovi la tua scheda, se ne hai una, e lo stato delle tue richieste.
      </p>

      <div className="card mt-6">
        {loading || session ? (
          <p className="text-sm text-slate-400">Un attimo…</p>
        ) : (
          <SignIn
            initialMode="signin"
            title="Email e password"
            description="Se non ti ricordi di averne fatto uno, probabilmente non ce l'hai: prenota una prova e l'account si crea lì."
          />
        )}
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Non ti sei mai allenato da noi?{" "}
        <Link href="/" className="text-accentSoft underline underline-offset-4">
          Prenota una prova gratuita
        </Link>
        .
      </p>
    </main>
  );
}
