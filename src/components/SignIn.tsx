"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Accesso con link via email: niente password da inventare, e
 * l'indirizzo risulta verificato per forza.
 */
export default function SignIn({
  title = "Accedi per continuare",
  description,
  onBeforeSend,
}: {
  title?: string;
  description?: string;
  onBeforeSend?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    onBeforeSend?.();

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });

    setBusy(false);
    if (error) {
      setError("Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-accent/45 bg-accent/[0.07] p-4">
        <p className="text-sm font-semibold text-white">Controlla la tua email</p>
        <p className="mt-1.5 text-sm text-slate-300">
          Abbiamo inviato un link di accesso a <strong>{email}</strong>. Aprilo da questo
          dispositivo e torni qui già dentro, senza password.
        </p>
        <button
          type="button"
          className="btn-ghost mt-4 !px-3 !py-1.5 text-xs"
          onClick={() => setSent(false)}
        >
          Usa un altro indirizzo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="text-sm font-semibold text-white">{title}</p>
      {description && <p className="mt-1.5 text-sm text-slate-400">{description}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="la-tua@email.it"
          className="field flex-1 min-w-[220px]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Invio…" : "Invia il link"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </form>
  );
}
