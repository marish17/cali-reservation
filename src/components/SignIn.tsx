"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

/**
 * Accesso con email e password: nessun messaggio da spedire, quindi
 * funziona per chiunque senza dipendere da un servizio di posta.
 */
export default function SignIn({
  title = "Accedi per continuare",
  description,
  onBeforeSubmit,
}: {
  title?: string;
  description?: string;
  onBeforeSubmit?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    onBeforeSubmit?.();

    const credentials = { email: email.trim(), password };

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    setBusy(false);

    if (error) {
      setError(translate(error.message));
      return;
    }

    // Se il progetto richiede la conferma dell'indirizzo, la
    // registrazione non apre una sessione: va detto, altrimenti
    // sembra che non sia successo nulla.
    if (mode === "signup" && !data.session) setPendingConfirm(true);
  }

  if (pendingConfirm) {
    return (
      <div className="rounded-xl border border-accent/45 bg-accent/[0.07] p-4">
        <p className="text-sm font-semibold text-white">Account creato</p>
        <p className="mt-1.5 text-sm text-slate-300">
          Per completare serve la conferma dell&apos;indirizzo: controlla la tua email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="text-sm font-semibold text-white">{title}</p>
      {description && <p className="mt-1.5 text-sm text-slate-400">{description}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" && (
            <p className="mt-1.5 text-xs text-slate-500">Almeno 8 caratteri.</p>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-4 grid gap-3 sm:flex sm:items-center">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Attendi…" : mode === "signup" ? "Crea l'account" : "Accedi"}
        </button>
        <button
          type="button"
          className="min-h-[40px] text-sm text-slate-400 underline underline-offset-4 hover:text-slate-200"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
        >
          {mode === "signup" ? "Ho già un account" : "Non ho un account"}
        </button>
      </div>
    </form>
  );
}

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o password non corretti.";
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Esiste già un account con questa email. Passa ad «Ho già un account».";
  }
  if (m.includes("password should be")) return "La password deve avere almeno 8 caratteri.";
  if (m.includes("email address") && m.includes("invalid")) return "Indirizzo email non valido.";
  if (m.includes("rate limit")) return "Troppi tentativi ravvicinati. Riprova fra qualche minuto.";
  return "Non è stato possibile completare l'operazione. Riprova.";
}
