"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Cambiare la propria password. Con una sessione aperta non serve
 * quella vecchia: è Supabase a garantire che la sessione sia tua.
 *
 * Non è un lusso: senza recupero via email, questa è l'unica strada
 * che una persona ha per rimettersi in mano il proprio account dopo
 * che un coach gliene ha dato una provvisoria.
 */
export default function ChangePassword({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    // Una password scritta male e non ripetuta chiude fuori chi l'ha
    // scelta, e senza email non c'è modo di rientrare.
    if (password !== again) {
      setError("Le due password non coincidono.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setError(
        error.message.toLowerCase().includes("should be different")
          ? "Scegline una diversa da quella attuale."
          : "Non è stato possibile cambiare la password. Riprova."
      );
      return;
    }

    // L'avviso «te l'ha messa il coach» può spegnersi.
    await supabase.rpc("note_password_changed");
    setBusy(false);
    setDone(true);
    setPassword("");
    setAgain("");
    onChanged?.();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => {
          setOpen(true);
          setDone(false);
        }}
      >
        {done ? "Password cambiata" : "Cambia password"}
      </button>
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div>
        <label className="label" htmlFor="new-password">
          Nuova password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-slate-500">Almeno 8 caratteri.</p>
      </div>

      <div>
        <label className="label" htmlFor="new-password-again">
          Ripetila
        </label>
        <input
          id="new-password-again"
          type="password"
          required
          autoComplete="new-password"
          className="field"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setAgain("");
            setError(null);
          }}
          disabled={busy}
        >
          Annulla
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? "Attendi…" : "Cambia password"}
        </button>
      </div>
    </form>
  );
}
