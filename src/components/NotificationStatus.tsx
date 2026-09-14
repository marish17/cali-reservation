"use client";

import { useEffect, useState } from "react";

type State = "granted" | "denied" | "default" | "needs-install" | "unsupported";

function detect(): State {
  if (typeof window === "undefined") return "unsupported";

  // Su iPhone gli avvisi esistono solo se il sito è stato aggiunto alla
  // schermata Home: in Safari normale l'API non c'è proprio.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;

  if (typeof Notification === "undefined") {
    return isIOS && !installed ? "needs-install" : "unsupported";
  }
  return Notification.permission;
}

/**
 * Senza email, gli avvisi del browser sono l'unico modo di accorgersi
 * di una richiesta senza guardare la pagina: bisogna poter vedere a
 * colpo d'occhio se sono accesi, e provarli.
 */
export default function NotificationStatus() {
  const [state, setState] = useState<State>("unsupported");
  const [tested, setTested] = useState(false);

  useEffect(() => setState(detect()), []);

  if (state === "unsupported") return null;

  if (state === "granted") {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
        Avvisi attivi
        <button
          className="underline underline-offset-2 hover:text-slate-200"
          onClick={() => {
            new Notification("Avviso di prova", {
              body: "Funziona: riceverai un messaggio così a ogni nuova richiesta.",
              tag: "prova",
            });
            setTested(true);
          }}
        >
          {tested ? "inviato" : "prova"}
        </button>
      </span>
    );
  }

  if (state === "needs-install") {
    return (
      <span className="text-[11px] text-slate-500">
        Avvisi non attivi — su iPhone aggiungi il sito alla schermata Home
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span className="text-[11px] text-slate-500">
        Avvisi bloccati dal browser — riattivali dalle impostazioni del sito
      </span>
    );
  }

  return (
    <button
      className="btn-ghost !min-h-[32px] !px-3 text-[11px]"
      onClick={() => void Notification.requestPermission().then(() => setState(detect()))}
    >
      Attiva gli avvisi
    </button>
  );
}
