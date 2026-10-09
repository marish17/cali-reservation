"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TabBar, { IconCalendar, IconClock, IconPerson, IconSheet, type Tab } from "@/components/TabBar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import type { Membership } from "@/lib/types";

/**
 * La barra in basso per chi si allena.
 *
 * Non compare a chi non è entrato: ha una cosa sola da fare, prenotare
 * la prova, e una barra con tre voci identiche sarebbe arredamento.
 * Nell'area coach non compare perché là ce n'è una sua, che sa aprire
 * il menu laterale.
 */
export default function AppTabs() {
  const pathname = usePathname();
  const { session, loading } = useSession();
  const [me, setMe] = useState<Membership | null>(null);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      setMe(null);
      return;
    }
    void (async () => {
      const { data } = await supabase.rpc("get_my_membership");
      setMe(((data as Membership[]) ?? [])[0] ?? null);
    })();
  }, [session]);

  if (loading || !session) return null;
  if (pathname.startsWith("/admin")) return null;

  // Il nome della prima voce dice cosa ci trovi davvero: per chi si
  // allena è la scheda, per chi deve ancora provare è il calendario.
  const trains = Boolean(me?.enrolled || me?.has_workout);

  const tabs: Tab[] = [
    {
      key: "home",
      label: trains ? "Scheda" : "Prenota",
      icon: trains ? IconSheet : IconCalendar,
      href: "/",
      active: pathname === "/" || pathname === "/scheda/",
    },
    {
      key: "timer",
      label: "Timer",
      icon: IconClock,
      href: "/timer",
      active: pathname.startsWith("/timer"),
    },
    {
      key: "profilo",
      label: "Profilo",
      icon: IconPerson,
      href: "/profilo",
      active: pathname.startsWith("/profilo"),
    },
  ];

  return <TabBar tabs={tabs} />;
}
