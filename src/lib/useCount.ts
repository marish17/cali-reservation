"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Conteggio tenuto aggiornato mentre la pagina è aperta. Ricontrolla a
 * intervalli e quando la scheda torna in primo piano, che è il momento
 * in cui la persona guarda davvero.
 */
export function useCount(fn: string, intervalMs = 60000) {
  const [count, setCount] = useState(0);
  const previous = useRef(0);
  const [increased, setIncreased] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc(fn);
    if (error) return;
    const next = Number(data ?? 0);
    setIncreased(next > previous.current);
    previous.current = next;
    setCount(next);
  }, [fn]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    const onFocus = () => void refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, intervalMs]);

  return { count, increased, refresh, acknowledge: () => setIncreased(false) };
}
