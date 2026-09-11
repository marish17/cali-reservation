"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

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
          <button
            className="btn-ghost mt-4"
            onClick={() => void supabase.auth.signOut().then(() => router.replace("/admin/login"))}
          >
            Esci
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <Logo size={28} />
        <h1 className="text-lg font-bold">Area coach</h1>
        <span className="badge">{email}</span>
        <button
          className="btn-ghost ml-auto !px-3 !py-1.5 text-xs"
          onClick={() => void supabase.auth.signOut().then(() => router.replace("/admin/login"))}
        >
          Esci
        </button>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-xl border px-3 py-2 text-sm transition",
              pathname === item.href
                ? "border-accent bg-accent/10 text-accentSoft"
                : "border-line text-slate-300 hover:border-slate-500",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
