"use client";

import { useEffect, useState } from "react";
import { useInstallState } from "@/lib/useInstallState";

const DISMISSED_KEY = "cali:install-hint-dismissed";

/**
 * Invito ad aggiungere il sito alla schermata Home. Non è vezzo: su
 * iPhone è la condizione perché le notifiche arrivino, e l'utente non
 * ha modo di saperlo da solo.
 */
export default function InstallHint() {
  const { installed, platform, promptInstall } = useInstallState();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (installed || dismissed) return null;

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Senza memoria locale ricomparirà: fastidio minore che insistere.
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/[0.07] p-4">
      <p className="text-sm font-semibold text-white">Tieni l&apos;Academy a portata di dito</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
        {platform === "ios" ? (
          <>
            Tocca <strong>Condividi</strong> in fondo allo schermo, poi{" "}
            <strong>Aggiungi a Home</strong>. Così prenoti con un tocco e puoi ricevere un
            avviso quando il coach risponde.
          </>
        ) : (
          <>
            Aggiungi il sito alla schermata Home: prenoti con un tocco e puoi ricevere un
            avviso quando il coach risponde.
          </>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {promptInstall && (
          <button
            className="btn-primary !min-h-[38px] text-xs"
            onClick={() => void promptInstall().finally(close)}
          >
            Aggiungi alla Home
          </button>
        )}
        <button
          className="min-h-[38px] px-1 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200"
          onClick={close}
        >
          Non adesso
        </button>
      </div>
    </div>
  );
}
