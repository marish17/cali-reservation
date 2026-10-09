"use client";

import { useEffect } from "react";

type Sentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
};

/**
 * Tiene acceso lo schermo mentre il timer corre.
 *
 * Senza, il telefono si spegne a metà serie e per sapere quanto manca
 * bisogna rianimarlo con le mani sporche. Dove non è supportato non
 * succede niente: il timer resta corretto perché legge l'orologio.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: Sentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
      } catch {
        // Permesso negato o batteria bassa: si rinuncia in silenzio.
      }
    };

    void acquire();

    // Tornando sull'app dopo averla lasciata, il blocco è decaduto e
    // va richiesto di nuovo.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel) void sentinel.release();
    };
  }, [active]);
}
