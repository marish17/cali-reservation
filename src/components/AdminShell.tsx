"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import CoachLogin from "@/components/CoachLogin";
import { supabase } from "@/lib/supabase";
import { useCount } from "@/lib/useCount";
import { ADMIN_NAV, samePath } from "@/lib/nav";
import CountBadge from "@/components/CountBadge";
import Avatar from "@/components/Avatar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "anon" | "ok" | "denied">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const signOut = () => void supabase.auth.signOut();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        // L'accesso si mostra qui invece di mandare il browser altrove:
        // con un sito statico quel salto può non arrivare mai, e si
        // resta fermi su "Verifica accesso" per sempre.
        setEmail(null);
        setState("anon");
        return;
      }

      setEmail(data.session.user.email ?? null);
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (cancelled) return;
      setState(isAdmin ? "ok" : "denied");
    }

    void check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "checking") {
    return <div className="mx-auto max-w-md px-4 py-20 text-sm text-slate-400">Verifica accesso…</div>;
  }

  if (state === "anon") {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-16">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={32} />
          <h1 className="text-2xl font-bold">Area coach</h1>
        </div>
        <p className="mb-6 text-sm text-slate-400">
          Accedi per gestire orari, prenotazioni e approvazioni.
        </p>
        <CoachLogin />
      </main>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="card border-accent/45">
          <h1 className="text-lg font-semibold text-white">Accesso non autorizzato</h1>
          <p className="mt-2 text-sm text-slate-300">
            L&apos;utente {email} non è tra gli amministratori. Aggiungilo alla tabella{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5">admins</code> in Supabase.
          </p>
          <button className="btn-ghost mt-4" onClick={signOut}>
            Esci
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminChrome email={email} onSignOut={signOut} pathname={pathname}>
      {children}
    </AdminChrome>
  );
}

function AdminChrome({
  email,
  onSignOut,
  pathname,
  children,
}: {
  email: string | null;
  onSignOut: () => void;
  pathname: string;
  children: React.ReactNode;
}) {
  const { count: pending, increased, acknowledge } = useCount("pending_count", 45000);
  // Chi allena può a sua volta essere allenato da un altro coach. La
  // voce compare solo se una scheda ce l'ha davvero: un link a una
  // pagina vuota è peggio di nessun link.
  const [hasWorkout, setHasWorkout] = useState(false);
  const [me, setMe] = useState<{ display_name: string | null; avatar_path: string | null } | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, w] = await Promise.all([
        supabase.rpc("get_my_profile"),
        supabase.rpc("get_my_workout"),
      ]);
      setMe(((p.data as typeof me[]) ?? [])[0] ?? null);
      setHasWorkout(((w.data as unknown[]) ?? []).length > 0);
    })();
  }, []);

  // Avviso del sistema operativo: è l'unico modo, senza email, di
  // accorgersi di una richiesta senza fissare la pagina.
  useEffect(() => {
    if (!increased || pending === 0) return;
    acknowledge();
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification("Nuova richiesta di prova", {
      body: pending === 1 ? "C'è una richiesta da approvare." : `Ci sono ${pending} richieste da approvare.`,
      tag: "richieste-in-attesa",
    });
  }, [increased, pending, acknowledge]);

  const items = hasWorkout
    ? [...ADMIN_NAV, { href: "/", label: "La mia scheda" }]
    : ADMIN_NAV;

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = samePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "inline-flex min-h-[46px] items-center rounded-xl px-3.5 text-sm transition",
              active
                ? "bg-accent/12 font-semibold text-accentSoft"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
            ].join(" ")}
          >
            {item.label}
            {item.href === "/admin" && <CountBadge count={pending} />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-0">
      <header className="app-header mb-5 flex items-center gap-3 pb-3">
        <Logo size={32} />
        <h1 className="text-base font-bold sm:text-lg">Area coach</h1>

        {/* Il numero resta visibile anche a menu chiuso: per sapere che
            c'è da lavorare non si deve aprire niente. */}
        <span className="lg:hidden">
          <CountBadge count={pending} />
        </span>

        {/* Sul telefono si esce da «Altro» o dal profilo. Qui serve
            solo sul computer, dove la barra in basso non c'è. */}
        <button
          className="btn-ghost ml-auto !hidden !min-h-[36px] !px-3 text-xs lg:!inline-flex"
          onClick={onSignOut}
        >
          Esci
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-8">
        {/* Sul computer c'è spazio: la colonna resta sempre aperta. */}
        <aside className="hidden lg:block">
          {nav}
          <div className="mt-5 border-t border-line pt-4">
            <Link
              href="/profilo"
              className="mb-3 flex min-w-0 items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200"
            >
              <Avatar name={me?.display_name} email={email} path={me?.avatar_path} size={26} />
              <span className="truncate">{me?.display_name || email}</span>
            </Link>
          </div>
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
