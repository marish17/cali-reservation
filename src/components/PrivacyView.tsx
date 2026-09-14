"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PrivacyText from "@/components/PrivacyText";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Privacy = { privacy_text: string | null; privacy_updated_at: string | null };

export default function PrivacyView() {
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data } = await supabase.rpc("get_privacy_text");
      setPrivacy(((data as Privacy[]) ?? [])[0] ?? null);
      setLoading(false);
    })();
  }, []);

  const text = privacy?.privacy_text?.trim();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 border-b border-line pb-3">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← Torna alle prenotazioni
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Informativa privacy</h1>
      {privacy?.privacy_updated_at && (
        <p className="mt-2 text-xs text-slate-500">
          Ultimo aggiornamento:{" "}
          {new Date(privacy.privacy_updated_at).toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}

      <div className="card mt-6">
        {loading ? (
          <p className="text-sm text-slate-400">Caricamento…</p>
        ) : text ? (
          <PrivacyText text={text} />
        ) : (
          <p className="text-sm text-slate-400">
            L&apos;informativa non è ancora disponibile. Scrivici per richiederla.
          </p>
        )}
      </div>
    </main>
  );
}
