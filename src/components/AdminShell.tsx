"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { useCount } from "@/lib/useCount";
import CountBadge from "@/components/CountBadge";
import NotificationStatus from "@/components/NotificationStatus";

const NAV = [
  { href: "/admin", label: "Prenotazioni" },
  { href: "/admin/orari", label: "Coach e orari" },
  { href: "/admin/chiusure", label: "Chiusure" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
  { href: "/admin/accessi", label: "Accessi" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const signOut = () =>
    void supabase.auth.signOut().then(() => router.replace("/admin/login"));

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        router.replace("/admin/login");
        setState("checking");
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
  }, [router]);

  if (state === "checking") {
    return <div className="mx-auto max-w-md px-4 py-20 text-sm text-slate-400">Verifica accesso…</div>;
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-5">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <Logo size={32} />
        <h1 className="text-lg font-bold">Area coach</h1>
        <span className="badge">{email}</span>
        <button className="btn-ghost ml-auto !min-h-[36px] !px-3 text-xs" onClick={onSignOut}>
          Esci
        </button>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <NotificationStatus />
      </div>

      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "inline-flex min-h-[42px] shrink-0 items-center whitespace-nowrap rounded-xl border px-3.5 text-sm transition active:scale-[0.98]",
              pathname === item.href
                ? "border-accent bg-accent/10 text-accentSoft"
                : "border-line text-slate-300 hover:border-slate-500",
            ].join(" ")}
          >
            {item.label}
            {item.href === "/admin" && <CountBadge count={pending} />}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
