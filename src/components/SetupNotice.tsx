export default function SetupNotice() {
  return (
    <div className="card border-amber-500/40 bg-amber-500/5">
      <h2 className="text-lg font-semibold text-amber-200">Configurazione mancante</h2>
      <p className="mt-2 text-sm text-slate-300">
        Imposta <code className="rounded bg-black/40 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in un
        file <code className="rounded bg-black/40 px-1.5 py-0.5">.env.local</code> (vedi{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5">.env.example</code>), poi riavvia il server.
      </p>
    </div>
  );
}
