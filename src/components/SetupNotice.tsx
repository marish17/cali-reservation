export default function SetupNotice() {
  return (
    <div className="card border-accent/45 bg-accent/[0.07]">
      <h2 className="text-lg font-semibold text-white">Configurazione mancante o non valida</h2>
      <p className="mt-2 text-sm text-slate-300">
        Serve un file <code className="rounded bg-black/40 px-1.5 py-0.5">.env.local</code> nella
        cartella del progetto (vedi <code className="rounded bg-black/40 px-1.5 py-0.5">.env.example</code>)
        con i valori presi da Supabase → <em>Project Settings → API</em>:
      </p>

      <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-ink/60 p-3 text-xs text-slate-300">
{`NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...`}
      </pre>

      <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
        <li>
          L&apos;URL deve iniziare con <code className="rounded bg-black/40 px-1 py-0.5">https://</code> e
          finire con <code className="rounded bg-black/40 px-1 py-0.5">.supabase.co</code>, senza barra finale.
        </li>
        <li>Niente virgolette, niente spazi attorno al segno di uguale.</li>
        <li>
          La chiave va presa dalla riga <strong>anon public</strong>, non da{" "}
          <code className="rounded bg-black/40 px-1 py-0.5">service_role</code>.
        </li>
        <li>Dopo ogni modifica al file, riavvia il server di sviluppo.</li>
      </ul>
    </div>
  );
}
