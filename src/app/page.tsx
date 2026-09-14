import BookingFlow from "@/components/BookingFlow";
import TopBar from "@/components/TopBar";
import SetupNotice from "@/components/SetupNotice";
import { createServerClient } from "@/lib/supabase-server";
import { readSupabaseEnv } from "@/lib/env";
import type { PublicSettings } from "@/lib/types";

export const revalidate = 60;

async function loadSettings(): Promise<PublicSettings | null> {
  const client = createServerClient();
  if (!client) return null;

  // Un database irraggiungibile non deve far fallire la pagina: si
  // ricade sui testi predefiniti e il resto continua a funzionare.
  try {
    const { data } = await client.rpc("get_public_settings");
    return ((data as PublicSettings[]) ?? [])[0] ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const configured = readSupabaseEnv() !== null;
  const settings = configured ? await loadSettings() : null;

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

      {configured ? <BookingFlow /> : <SetupNotice />}

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
