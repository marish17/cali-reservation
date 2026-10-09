"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePush } from "@/lib/usePush";

/**
 * Le notifiche, spiegate e gestite in un posto solo: il profilo.
 *
 * Prima lo stesso avviso compariva in cima a quattro pagine diverse.
 * Ripeterlo non lo rendeva più efficace: una riga che c'è sempre
 * smette di essere letta, e intanto rubava spazio in cima a schermate
 * che servivano ad altro.
 *
 * Qui invece c'è lo spazio per dire cosa si guadagna ad attivarle,
 * che è l'unica cosa che convince qualcuno a farlo.
 */
export default function PushToggle({
  audience,
}: {
  audience: "coach" | "booker" | "student";
}) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const { state, busy, error, enable, disable } = usePush(publicKey);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_public_settings");
      const row = (data as { vapid_public_key?: string | null }[] | null)?.[0];
      setPublicKey(row?.vapid_public_key ?? null);
    })();
  }, []);

  const what =
    audience === "coach"
      ? "quando qualcuno richiede una prova"
      : audience === "student"
        ? "quando il tuo coach aggiorna la scheda"
        : "quando il coach risponde alla tua richiesta";

  if (state === "loading") {
    return <p className="text-sm text-slate-500">Un attimo…</p>;
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-slate-400">
        Questo browser non le supporta. Da iPhone funzionano solo con il sito
        aggiunto alla schermata Home.
      </p>
    );
  }

  if (state === "needs-install") {
    return (
      <Box tone="hint">
        <p className="text-sm text-slate-200">
          Per ricevere un avviso {what}, aggiungi prima il sito alla schermata
          Home.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Tocca <strong className="text-slate-300">Condividi</strong> in fondo
          allo schermo, poi{" "}
          <strong className="text-slate-300">Aggiungi a Home</strong>. Riapri
          l&apos;app da lì e torna qui.
        </p>
      </Box>
    );
  }

  if (state === "denied") {
    return (
      <Box tone="hint">
        <p className="text-sm text-slate-200">
          Le notifiche sono bloccate da questo browser.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Per riattivarle: impostazioni del sito →{" "}
          <strong className="text-slate-300">Notifiche</strong> → Consenti. Poi
          torna qui.
        </p>
      </Box>
    );
  }

  if (state === "on") {
    return (
      <Box tone="on">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
          <p className="flex-1 text-sm font-medium text-slate-100">
            Attive su questo dispositivo
          </p>
          <button
            className="shrink-0 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200 disabled:opacity-50"
            onClick={() => void disable()}
            disabled={busy}
          >
            disattiva
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Ricevi un avviso {what}, anche a schermo spento.
        </p>
        {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
      </Box>
    );
  }

  if (!publicKey) {
    return (
      <p className="text-sm text-slate-400">
        Non sono ancora configurate sul server.
      </p>
    );
  }

  // Spente: qui si dice cosa ci si perde, non solo che sono spente.
  return (
    <Box tone="off">
      <p className="text-sm text-slate-200">
        Attivale per sapere subito {what}, senza dover aprire l&apos;app per
        controllare.
      </p>
      <button className="btn-primary mt-3 w-full sm:w-auto" onClick={() => void enable()} disabled={busy}>
        {busy ? "Attendi…" : "Attiva le notifiche"}
      </button>
      {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
    </Box>
  );
}

function Box({ tone, children }: { tone: "on" | "off" | "hint"; children: React.ReactNode }) {
  const border =
    tone === "on"
      ? "border-emerald-400/35 bg-emerald-400/[0.06]"
      : tone === "off"
        ? "border-accent/40 bg-accent/[0.06]"
        : "border-line bg-ink/40";
  return <div className={`rounded-xl border p-3.5 ${border}`}>{children}</div>;
}
