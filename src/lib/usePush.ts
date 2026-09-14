"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PushState =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

/** La chiave pubblica arriva dal browser come stringa base64url. */
function toUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function environment(): Exclude<PushState, "loading" | "off" | "on"> | null {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    // Su iPhone le push esistono solo dopo l'aggiunta alla Home: è una
    // condizione da spiegare, non un "non supportato" da subire.
    return isIOS && !installed ? "needs-install" : "unsupported";
  }
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return "denied";
  }
  return null;
}

export function usePush(publicKey: string | null) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const blocked = environment();
    if (blocked) {
      setState(blocked);
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();
    setState(existing ? "on" : "off");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!publicKey) throw new Error("NO_KEY");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: subscription.endpoint,
        p_p256dh: json.keys?.p256dh ?? toBase64(subscription.getKey("p256dh")),
        p_auth: json.keys?.auth ?? toBase64(subscription.getKey("auth")),
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;

      setState("on");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message === "NO_KEY"
          ? "Le notifiche non sono ancora configurate sul server."
          : "Non è stato possibile attivare le notifiche su questo dispositivo."
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [publicKey, refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await supabase.rpc("delete_push_subscription", { p_endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
