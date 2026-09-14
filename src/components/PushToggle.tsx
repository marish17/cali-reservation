"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePush } from "@/lib/usePush";

/**
 * Attivazione delle notifiche, con lo stato sempre in chiaro: senza
 * email sono l'unico modo di essere avvisati, quindi non basta che
 * funzionino, bisogna poter vedere che sono accese.
 */
export default function PushToggle({ audience }: { audience: "coach" | "booker" }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { state, busy, error, enable, disable } = usePush(publicKey);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_public_settings");
      const row = (data as { vapid_public_key?: string | null }[] | null)?.[0];
      setPublicKey(row?.vapid_public_key ?? null);
    })();
  }, []);

  if (state === "loading" || state === "unsupported") return null;

  const what =
    audience === "coach"
      ? "quando arriva una richiesta"
      : "quando il coach risponde";

  if (state === "needs-install") {
    return (
      <p className="text-[11px] leading-relaxed text-slate-500">
        Per ricevere un avviso {what} anche a schermo spento, aggiungi il sito alla schermata
        Home: <strong>Condividi → Aggiungi a Home</strong>.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-[11px] leading-relaxed text-slate-500">
        Notifiche bloccate da questo browser. Per riattivarle: impostazioni del sito →
        Notifiche → Consenti.
      </p>
    );
  }

  if (state === "on") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-accent" />
        Notifiche attive su questo dispositivo
        <button
          className="underline underline-offset-2 hover:text-slate-200 disabled:opacity-50"
          onClick={() => void disable()}
          disabled={busy}
        >
          disattiva
        </button>
      </span>
    );
  }

  if (!publicKey) {
    return (
      <span className="text-[11px] text-slate-500">
        Notifiche non ancora configurate sul server.
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost !min-h-[32px] !px-3 text-[11px]"
        onClick={() => void enable()}
        disabled={busy}
      >
        {busy ? "Attivo…" : `Avvisami ${what}`}
      </button>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </span>
  );
}
