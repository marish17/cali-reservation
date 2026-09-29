"use client";

import { useState } from "react";
import { deleteAccount, resetPassword } from "@/lib/adminActions";
import type { Person } from "@/lib/types";

/**
 * Le operazioni che non si annullano. Stanno in fondo alla pagina,
 * chiuse, e la cancellazione chiede di scrivere il nome: un pulsante
 * rosso da solo si preme per sbaglio, e qui non c'è modo di tornare
 * indietro.
 */
export default function PersonDanger({
  person,
  onArchive,
  onDeleted,
}: {
  person: Person;
  onArchive: (active: boolean) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = person.display_name || person.email || "";

  async function reset() {
    setBusy(true);
    setError(null);
    setPassword(null);
    try {
      setPassword(await resetPassword(person.user_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(person.user_id);
      await onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore imprevisto.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className="w-full text-center text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300"
        onClick={() => setOpen(true)}
      >
        Password e cancellazione
      </button>
    );
  }

  return (
    <section className="card border-accent/35">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold">Password e cancellazione</h3>
        <button
          className="ml-auto text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200"
          onClick={() => setOpen(false)}
        >
          chiudi
        </button>
      </div>

      {person.is_coach && (
        <p className="mt-3 rounded-xl border border-line bg-ink/40 p-3 text-sm text-slate-300">
          Questa persona è un coach. La password e l&apos;account di un coach si
          gestiscono dalla dashboard di Supabase, non da qui: altrimenti
          chiunque di voi potrebbe prendersi l&apos;accesso di un collega.
        </p>
      )}

      {!person.is_coach && (
        <>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-200">Password dimenticata</p>
            <p className="mt-1 text-sm text-slate-400">
              Ne genera una provvisoria da leggere alla persona. Finché non se
              la cambia, la conosci anche tu — e l&apos;app glielo ricorda.
            </p>

            {password ? (
              <div className="mt-3 rounded-xl border border-accent/45 bg-accent/[0.07] p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Password provvisoria
                </p>
                <p className="mt-1 select-all font-mono text-lg font-semibold text-white">
                  {password}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Copiala ora: chiudendo non si rivede più. Se la perdi, ne
                  generi un&apos;altra.
                </p>
              </div>
            ) : (
              <button className="btn-ghost mt-3" onClick={() => void reset()} disabled={busy}>
                {busy ? "Attendi…" : "Genera una password provvisoria"}
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm font-medium text-slate-200">Togli dall&apos;elenco</p>
            <p className="mt-1 text-sm text-slate-400">
              Sparisce dalle persone attive ma non si perde niente: scheda,
              questionario e valutazioni restano, e si può rimettere.
            </p>
            <button
              className="btn-ghost mt-3"
              onClick={() => void onArchive(!person.active)}
              disabled={busy}
            >
              {person.active ? "Archivia" : "Rimetti fra gli attivi"}
            </button>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm font-medium text-slate-200">Cancella l&apos;account</p>
            <p className="mt-1 text-sm text-slate-400">
              Sparisce tutto e per sempre: accesso, scheda, questionario,
              valutazioni, prenotazioni. Non si torna indietro. Se la persona
              ha semplicemente smesso di venire, archiviala invece.
            </p>

            {confirming ? (
              <div className="mt-3">
                <label className="label" htmlFor="confirm-name">
                  Scrivi «{label}» per confermare
                </label>
                <input
                  id="confirm-name"
                  className="field"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-ghost flex-1"
                    onClick={() => {
                      setConfirming(false);
                      setTyped("");
                    }}
                    disabled={busy}
                  >
                    Annulla
                  </button>
                  <button
                    className="btn flex-1 bg-accent text-white hover:bg-accent/85"
                    onClick={() => void remove()}
                    disabled={busy || typed.trim() !== label.trim()}
                  >
                    {busy ? "Cancello…" : "Cancella per sempre"}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn-ghost mt-3" onClick={() => setConfirming(true)}>
                Cancella l&apos;account…
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-200">{error}</p>}
    </section>
  );
}
