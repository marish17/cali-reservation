"use client";

import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "desktop";

export type InstallState = {
  installed: boolean;
  platform: Platform;
  /** Disponibile solo dove il browser offre l'installazione guidata. */
  promptInstall: (() => Promise<void>) | null;
};

type InstallEvent = Event & { prompt: () => Promise<void> };

export function useInstallState(): InstallState {
  const [installed, setInstalled] = useState(true); // finché non si sa, non si insiste
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "desktop");

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    // Chrome e derivati avvisano quando l'installazione è possibile.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return {
    installed,
    platform,
    promptInstall: event ? () => event.prompt() : null,
  };
}
