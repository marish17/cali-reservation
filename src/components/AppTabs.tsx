"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import TabBar, {
  IconCalendar,
  IconClock,
  IconMore,
  IconPeople,
  IconPerson,
  IconSheet,
  type Tab,
} from "@/components/TabBar";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useCount } from "@/lib/useCount";
import { ADMIN_NAV, samePath, underPath } from "@/lib/nav";
import type { Membership } from "@/lib/types";

type Me = {
  admin: boolean;
  trains: boolean;
  name: string | null;
  avatar: string | null;
};

/**
 * La barra in basso, una sola per tutta l'app.
 *
 * Le voci dipendono da chi sei, non da dove ti trovi: un coach che si
 * allena ha la sua scheda accanto alle richieste e se la ritrova
 * uguale ovunque vada. Una barra che cambia sotto i piedi mentre si
 * naviga costringe a rileggerla ogni volta.
 */
export default function AppTabs() {
  const pathname = usePathname();
  const { session, loading } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      setMe(null);
      return;
    }
    void (async () => {
      const [a, m, p] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("get_my_membership"),
        supabase.rpc("get_my_profile"),
      ]);
      const membership = ((m.data as Membership[]) ?? [])[0] ?? null;
      const profile = ((p.data as { display_name: string | null; avatar_path: string | null }[]) ?? [])[0];
      setMe({
        admin: Boolean(a.data),
        trains: Boolean(membership?.enrolled || membership?.has_workout),
        name: profile?.display_name ?? null,
        avatar: profile?.avatar_path ?? null,
      });
    })();
  }, [session]);

  // Cambiando pagina il foglio si chiude da solo: restare aperto sopra
  // la sezione appena scelta è il difetto classico di questi menu.
  useEffect(() => setSheet(false), [pathname]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet]);

  if (loading || !session || !me) return null;
  // Senza accesso l'area coach mostra già la sua schermata di login.
  if (pathname.startsWith("/admin") && !me.admin) return null;

  // Le sezioni che non hanno una voce loro stanno dentro «Altro»:
  // trovandosi lì dentro, è «Altro» a dover risultare acceso. Una
  // barra in cui non si illumina niente sembra guasta.
  // «/admin» vale solo per sé stesso: come prefisso coprirebbe ogni
  // sottopagina, e «Altro» non si accenderebbe mai.
  const coveredByTab =
    samePath(pathname, "/admin") ||
    ["/admin/allievi", "/timer"].some((h) => underPath(pathname, h)) ||
    samePath(pathname, "/");
  const inOther = pathname.startsWith("/admin") && !coveredByTab;

  const tabs: Tab[] = me.admin
    ? [
        {
          key: "richieste",
          label: "Richieste",
          icon: IconCalendar,
          href: "/admin",
          active: samePath(pathname, "/admin"),
          badge: 0,
        },
        {
          key: "allievi",
          label: "Allievi",
          icon: IconPeople,
          href: "/admin/allievi",
          active: underPath(pathname, "/admin/allievi"),
        },
        // Un coach che si allena ha la sua scheda qui, accanto al
        // resto: andarla a cercare altrove sarebbe assurdo.
        ...(me.trains
          ? [
              {
                key: "scheda",
                label: "Scheda",
                icon: IconSheet,
                // La scheda sta sulla pagina iniziale, per tutti: due
                // pagine che mostrano la stessa cosa erano il difetto.
                href: "/",
                active: samePath(pathname, "/"),
              },
            ]
          : []),
        {
          key: "timer",
          label: "Timer",
          icon: IconClock,
          href: "/timer",
          active: underPath(pathname, "/timer"),
        },
        {
          key: "altro",
          label: "Altro",
          icon: IconMore,
          onClick: () => setSheet(true),
          active: sheet || inOther,
        },
      ]
    : [
        {
          key: "home",
          label: me.trains ? "Scheda" : "Prenota",
          icon: me.trains ? IconSheet : IconCalendar,
          href: "/",
          active: samePath(pathname, "/"),
        },
        {
          key: "timer",
          label: "Timer",
          icon: IconClock,
          href: "/timer",
          active: underPath(pathname, "/timer"),
        },
        {
          key: "profilo",
          label: "Profilo",
          icon: IconPerson,
          href: "/profilo",
          active: underPath(pathname, "/profilo"),
        },
      ];

  return (
    <>
      {me.admin ? <AdminBar tabs={tabs} /> : <TabBar tabs={tabs} />}

      {sheet && (
        <MoreSheet
          pathname={pathname}
          name={me.name}
          avatar={me.avatar}
          email={session.user.email ?? null}
          onClose={() => setSheet(false)}
        />
      )}
    </>
  );
}

/** Le richieste in attesa vanno contate solo se c'è un coach a guardarle. */
function AdminBar({ tabs }: { tabs: Tab[] }) {
  const { count } = useCount("pending_count", 45000);
  return <TabBar tabs={tabs.map((t) => (t.key === "richieste" ? { ...t, badge: count } : t))} />;
}

function MoreSheet({
  pathname,
  name,
  avatar,
  email,
  onClose,
}: {
  pathname: string;
  name: string | null;
  avatar: string | null;
  email: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button className="absolute inset-0 bg-black/70" aria-label="Chiudi" onClick={onClose} />

      {/* Sale dal basso, da dove è stato toccato: un pannello che
          arriva dal lato opposto fa perdere il filo. */}
      <div
        className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 shadow-2xl"
        style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}
      >
        <div className="mb-4 flex items-center gap-3 border-b border-line pb-3">
          <Logo size={28} />
          <span className="text-sm font-bold">Area coach</span>
          <button
            className="btn-ghost ml-auto !min-h-[36px] !w-10 !px-0"
            aria-label="Chiudi"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <nav className="grid grid-cols-2 gap-2">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "inline-flex min-h-[52px] items-center rounded-xl px-3.5 text-sm transition",
                samePath(pathname, item.href)
                  ? "bg-accent/12 font-semibold text-accentSoft"
                  : "border border-line text-slate-300 hover:bg-white/5",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <Link href="/profilo" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-300">
            <Avatar name={name} email={email} path={avatar} size={30} />
            <span className="truncate">{name || email}</span>
          </Link>
          <button
            className="btn-ghost !min-h-[38px] !px-3 text-xs"
            onClick={() => void supabase.auth.signOut()}
          >
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
