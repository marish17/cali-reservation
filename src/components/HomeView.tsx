"use client";

import { useEffect, useState } from "react";
import BookingFlow from "@/components/BookingFlow";
import InstallHint from "@/components/InstallHint";
import SetupNotice from "@/components/SetupNotice";
import TopBar from "@/components/TopBar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PublicSettings } from "@/lib/types";

/**
 * I testi arrivano dal database mentre la pagina è già a schermo: il
 * sito resta un pacchetto di file statici, senza un server acceso a
 * ricostruirlo a ogni visita.
 */
export default function HomeView() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void (async () => {
      const { data } = await supabase.rpc("get_public_settings");
      setSettings(((data as PublicSettings[]) ?? [])[0] ?? null);
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 pt-3 sm:pb-16 sm:pt-6">
      <TopBar gymName={settings?.gym_name ?? "Calisthenics Academy"} />

      <header className="mb-6 sm:mb-8">
        <h1 className="text-[26px] font-bold leading-[1.15] sm:text-4xl">
          Prenota la tua prova gratuita
        </h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-400">
          {settings?.intro_text ??
            "Scegli il giorno e l'orario in cui il coach è presente. Bastano trenta secondi."}
        </p>
      </header>

      <InstallHint />

      {isSupabaseConfigured ? <BookingFlow /> : <SetupNotice />}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-slate-500">
        {(settings?.contact_email || settings?.contact_phone) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 py-2">
            {settings?.contact_email && <span>{settings.contact_email}</span>}
            {settings?.contact_phone && <span>{settings.contact_phone}</span>}
          </div>
        )}
        <div className="flex items-center justify-between">
          <a className="inline-flex min-h-[40px] items-center hover:text-slate-300" href="/privacy">
            Informativa privacy
          </a>
          <a className="inline-flex min-h-[40px] items-center hover:text-slate-300" href="/admin">
            Area coach
          </a>
        </div>
      </footer>
    </main>
  );
}
