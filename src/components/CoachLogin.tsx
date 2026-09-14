"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Accesso al pannello. Sta in un componente e non solo in una pagina
 * perché il pannello lo mostra al posto suo quando non c'è sessione:
 * mandare altrove il browser, con un sito statico, è un passaggio che
 * può non arrivare mai a destinazione.
 */
export default function CoachLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);
    if (error) setError("Email o password non corretti.");
  }

  return (
    <form className="card space-y-4" onSubmit={submit}>
      <div>
        <label className="label" htmlFor="coach-email">
          Email
        </label>
        <input
          id="coach-email"
          type="email"
          className="field"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="coach-password">
          Password
        </label>
        <input
          id="coach-password"
          type="password"
          className="field"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Accesso…" : "Accedi"}
      </button>
    </form>
  );
}
