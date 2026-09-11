"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bookingErrorMessage } from "@/lib/errors";

type AdminRow = {
  admin_id: string;
  admin_email: string | null;
  granted_at: string;
  is_me: boolean;
};

export default function AdminAccessPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_admins");
    if (error) setError(bookingErrorMessage(error));
    else setRows((data as AdminRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const { error } = await supabase.rpc("grant_admin", { p_email: email.trim() });
    setBusy(false);

    if (error) {
      setError(bookingErrorMessage(error));
      return;
    }
    setDone(`${email.trim()} ora ha accesso al pannello.`);
    setEmail("");
    void load();
  }

  async function revoke(row: AdminRow) {
    if (!confirm(`Togliere l'accesso a ${row.admin_email}?`)) return;
    setError(null);
    setDone(null);
    const { error } = await supabase.rpc("revoke_admin", { p_user_id: row.admin_id });
    if (error) setError(bookingErrorMessage(error));
    else void load();
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="text-base font-semibold">Dai accesso a un coach</h2>
        <p className="mt-2 text-sm text-slate-400">
          Prima la persona deve entrare una volta dal sito: apre la home, inizia una
          prenotazione e accede col link che riceve via email. Da quel momento il suo
          indirizzo esiste ed è verificato, e puoi abilitarlo qui.
        </p>

        <form className="mt-4 flex flex-wrap gap-2" onSubmit={grant}>
          <input
            type="email"
            required
            className="field flex-1 min-w-[220px]"
            placeholder="coach@tuapalestra.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Attendi…" : "Dai accesso"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
        {done && <p className="mt-3 text-sm text-accentSoft">{done}</p>}
      </section>

      <section className="card">
        <h2 className="text-base font-semibold">Chi ha accesso</h2>

        {loading && <p className="mt-3 text-sm text-slate-400">Caricamento…</p>}

        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.admin_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink/40 px-3 py-2 text-sm"
            >
              <span className="truncate">{row.admin_email ?? "(email sconosciuta)"}</span>
              {row.is_me && <span className="badge">sei tu</span>}
              {!row.is_me && (
                <button
                  className="btn-ghost ml-auto !px-2.5 !py-1 text-xs"
                  onClick={() => void revoke(row)}
                >
                  Togli accesso
                </button>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-500">
          L&apos;accesso al pannello e la presenza in palestra sono due cose distinte:
          perché gli orari di un coach compaiano nel calendario va aggiunto anche in
          <strong className="text-slate-400"> Coach e orari</strong>.
        </p>
      </section>
    </div>
  );
}
