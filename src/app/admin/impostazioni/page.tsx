"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import type { Settings } from "@/lib/types";

type EmailCheck = {
  ok: boolean;
  reason?: string;
  detail?: string;
  hasApiKey: boolean;
  recipients: string[];
  invalidRecipients: string[];
  rawRecipients: string;
  sender: string;
};

export default function AdminSettingsPage() {
  const { session } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", true).single();
      if (data) setSettings(data as Settings);
    })();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setStatus("saving");
    const { error } = await supabase
      .from("settings")
      .update({
        ...settings,
        privacy_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setStatus(error ? "error" : "saved");
  }

  if (!settings) return <p className="card text-sm text-slate-400">Caricamento…</p>;

  // I segnaposto fra parentesi quadre sono i punti che solo tu puoi
  // compilare: meglio dirlo qui che scoprirli online.
  const placeholdersLeft = [...(settings.privacy_text ?? "").matchAll(/\[([^\]]+)\]/g)]
    .map((match) => match[0])
    .filter((value, index, all) => all.indexOf(value) === index);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
    setStatus("idle");
  };

  return (
    <>
    <form className="card space-y-5" onSubmit={save}>
      <div>
        <h2 className="text-base font-semibold">Regole di prenotazione</h2>
        <p className="mt-1 text-sm text-slate-400">
          Valgono per tutta la palestra e sono applicate dal database, non dal browser.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Prove max al giorno</label>
          <input
            type="number"
            min={0}
            max={100}
            className="field"
            value={settings.max_trials_per_day}
            onChange={(e) => set("max_trials_per_day", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Giorni prenotabili in anticipo</label>
          <input
            type="number"
            min={1}
            max={365}
            className="field"
            value={settings.booking_horizon_days}
            onChange={(e) => set("booking_horizon_days", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Preavviso minimo (ore)</label>
          <input
            type="number"
            min={0}
            max={168}
            className="field"
            value={settings.min_notice_hours}
            onChange={(e) => set("min_notice_hours", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-base font-semibold">Età dei partecipanti</h2>
        <p className="mt-1 text-sm text-slate-400">
          L&apos;età è calcolata dalla data di nascita, al giorno della prova.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Età minima per partecipare</label>
          <input
            type="number"
            min={0}
            max={99}
            className="field"
            value={settings.min_age}
            onChange={(e) => set("min_age", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Accompagnatore obbligatorio sotto i</label>
          <input
            type="number"
            min={0}
            max={99}
            className="field"
            value={settings.guardian_required_under_age}
            onChange={(e) => set("guardian_required_under_age", Number(e.target.value))}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Sotto questa età il form chiede nome e telefono del genitore o tutore.
          </p>
        </div>
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-base font-semibold">Pagina pubblica</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nome della palestra</label>
          <input
            className="field"
            value={settings.gym_name}
            onChange={(e) => set("gym_name", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Testo introduttivo</label>
          <textarea
            className="field min-h-[80px] resize-y"
            value={settings.intro_text}
            onChange={(e) => set("intro_text", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Email di contatto</label>
          <input
            type="email"
            className="field"
            value={settings.contact_email ?? ""}
            onChange={(e) => set("contact_email", e.target.value || null)}
          />
        </div>
        <div>
          <label className="label">Telefono di contatto</label>
          <input
            className="field"
            value={settings.contact_phone ?? ""}
            onChange={(e) => set("contact_phone", e.target.value || null)}
          />
        </div>
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-base font-semibold">Informativa privacy</h2>
        <p className="mt-1 text-sm text-slate-400">
          Mostrata su <code className="rounded bg-black/40 px-1.5 py-0.5">/privacy</code> e
          collegata alla casella di consenso nel modulo. Una riga che inizia con{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5">##</code> diventa un titolo.
        </p>

        {placeholdersLeft.length > 0 && (
          <p className="mt-3 rounded-xl border border-accent/45 bg-accent/[0.07] p-3 text-sm text-slate-200">
            Da compilare prima di pubblicare: {placeholdersLeft.join(", ")}
          </p>
        )}

        <textarea
          className="field mt-3 min-h-[320px] resize-y font-mono text-xs leading-relaxed"
          value={settings.privacy_text ?? ""}
          onChange={(e) => set("privacy_text", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button className="btn-primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Salvataggio…" : "Salva"}
        </button>
        {status === "saved" && <span className="text-sm text-accentSoft">Impostazioni salvate.</span>}
        {status === "error" && (
          <span className="text-sm text-red-200">Errore durante il salvataggio.</span>
        )}
      </div>
    </form>

    <EmailDiagnostics accessToken={session?.access_token ?? null} />
    </>
  );
}

function EmailDiagnostics({ accessToken }: { accessToken: string | null }) {
  const [result, setResult] = useState<EmailCheck | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!accessToken) return;
    setBusy(true);
    setResult(null);

    const response = await fetch("/api/email-check", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);

    setBusy(false);
    const body = (await response?.json().catch(() => null)) as EmailCheck | null;
    if (body) setResult(body);
  }

  return (
    <section className="card">
      <h2 className="text-base font-semibold">Email di avviso</h2>
      <p className="mt-1 text-sm text-slate-400">
        Prova l&apos;invio e mostra la risposta esatta del servizio. Utile quando le email
        non arrivano e non si capisce perché.
      </p>

      <button className="btn-ghost mt-4" onClick={() => void run()} disabled={busy || !accessToken}>
        {busy ? "Invio…" : "Invia un'email di prova"}
      </button>

      {result && (
        <div
          className={[
            "mt-4 rounded-xl border p-4 text-sm",
            result.ok ? "border-accent/45 bg-accent/[0.07]" : "border-red-500/40 bg-red-500/10",
          ].join(" ")}
        >
          <p className="font-semibold text-white">
            {result.ok ? "Email inviata." : "Invio non riuscito."}
          </p>

          {!result.ok && result.reason && (
            <p className="mt-1.5 text-slate-200">{result.reason}</p>
          )}

          <dl className="mt-3 space-y-1 text-xs text-slate-400">
            <div>Chiave del servizio: {result.hasApiKey ? "presente" : "MANCANTE"}</div>
            <div>Mittente: {result.sender}</div>
            <div>
              Destinatari:{" "}
              {result.recipients.length ? result.recipients.join(", ") : "NESSUNO"}
            </div>
            {result.invalidRecipients?.length > 0 && (
              <div className="text-red-300">
                Scartati perché non validi: {result.invalidRecipients.join(" | ")}
              </div>
            )}
            {result.rawRecipients !== undefined && (
              <div>
                Valore di NOTIFY_EMAIL:{" "}
                <code className="rounded bg-black/40 px-1 py-0.5">
                  {result.rawRecipients || "(vuoto)"}
                </code>
              </div>
            )}
          </dl>

          {!result.ok && result.detail && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-slate-300">
              {result.detail}
            </pre>
          )}

          {result.ok && (
            <p className="mt-3 text-xs text-slate-400">
              Se non la vedi arrivare, guarda nello spam. Col mittente condiviso di prova,
              il servizio consegna soltanto all&apos;indirizzo con cui è stato registrato
              l&apos;account.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
