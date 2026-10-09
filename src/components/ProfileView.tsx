"use client";

import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import ChangePassword from "@/components/ChangePassword";
import PushToggle from "@/components/PushToggle";
import SignIn from "@/components/SignIn";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { bookingErrorMessage } from "@/lib/errors";
import { resizeToSquare } from "@/lib/resizeImage";

type Profile = {
  display_name: string | null;
  avatar_path: string | null;
  email: string | null;
  phone: string | null;
};

export default function ProfileView() {
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Il testo delle notifiche cambia: a un coach arrivano le richieste,
  // a chi si allena gli aggiornamenti della scheda.
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data }, admin] = await Promise.all([
      supabase.rpc("get_my_profile"),
      supabase.rpc("is_admin"),
    ]);
    setIsAdmin(Boolean(admin.data));
    const row = ((data as Profile[]) ?? [])[0] ?? null;
    setProfile(row);
    setName(row?.display_name ?? "");
    setPhone(row?.phone ?? "");
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    const { error } = await supabase.rpc("save_my_profile", {
      p_display_name: name,
      p_avatar_path: profile?.avatar_path ?? null,
    });
    if (error) {
      setError(bookingErrorMessage(error));
      setStatus("idle");
      return;
    }

    // Chi si è registrato prima che il numero fosse obbligatorio non
    // viene bloccato: se lo lascia vuoto, il resto si salva comunque.
    if (phone.trim() && phone.trim() !== (profile?.phone ?? "")) {
      const { error: phoneError } = await supabase.rpc("save_my_phone", {
        p_phone: phone.trim(),
      });
      if (phoneError) {
        setError(bookingErrorMessage(phoneError));
        setStatus("idle");
        return;
      }
    }
    setStatus("saved");
    void load();
  }

  async function upload(file: File) {
    if (!session) return;
    setUploading(true);
    setError(null);

    try {
      const blob = await resizeToSquare(file);
      // Il nome cambia a ogni caricamento: se restasse uguale, i
      // browser continuerebbero a mostrare la foto vecchia dalla cache.
      const path = `${session.user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { error: saveError } = await supabase.rpc("save_my_profile", {
        p_display_name: name,
        p_avatar_path: path,
      });
      if (saveError) throw saveError;

      // La precedente non serve più: l'archivio è piccolo, non la si
      // lascia lì a occupare spazio.
      if (profile?.avatar_path) {
        await supabase.storage.from("avatars").remove([profile.avatar_path]);
      }

      await load();
    } catch {
      setError("Non è stato possibile caricare la foto. Riprova con un'altra immagine.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!profile?.avatar_path) return;
    setUploading(true);
    await supabase.storage.from("avatars").remove([profile.avatar_path]);
    await supabase.rpc("save_my_profile", { p_display_name: name, p_avatar_path: null });
    await load();
    setUploading(false);
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-10">
      <PageHeader
        title="Il mio profilo"
        actions={
          session ? (
            <button
              className="btn-ghost !min-h-[36px] !px-3 text-xs"
              onClick={() => void supabase.auth.signOut()}
            >
              Esci
            </button>
          ) : null
        }
      />

      <p className="text-sm text-slate-400">
        Nome e foto con cui ti riconoscono gli altri, sia come allievo sia come coach.
      </p>

      {sessionLoading ? (
        <p className="card mt-6 text-sm text-slate-400">Un attimo…</p>
      ) : !session ? (
        <div className="card mt-6">
          <SignIn title="Accedi per modificare il profilo" />
        </div>
      ) : (
        <form className="card mt-6 space-y-5" onSubmit={save}>
          <div className="flex items-center gap-4">
            <Avatar
              name={profile?.display_name}
              email={profile?.email}
              path={profile?.avatar_path}
              size={72}
            />
            <div className="min-w-0">
              <label className="btn-ghost !min-h-[38px] cursor-pointer text-xs">
                {uploading ? "Caricamento…" : profile?.avatar_path ? "Cambia foto" : "Carica una foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {profile?.avatar_path && (
                <button
                  type="button"
                  className="ml-2 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200"
                  onClick={() => void removePhoto()}
                  disabled={uploading}
                >
                  togli
                </button>
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                Viene ritagliata quadrata e ridotta: non serve una foto grande.
              </p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="display_name">
              Nome e cognome
            </label>
            <input
              id="display_name"
              className="field"
              maxLength={80}
              placeholder="Come vuoi essere chiamato"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setStatus("idle");
              }}
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Cellulare
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="field"
              placeholder="333 1234567"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setStatus("idle");
              }}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {profile?.phone
                ? "Serve al coach per avvisarti se qualcosa cambia."
                : "Non ce l'hai ancora: lascialo, così il coach può raggiungerti."}
            </p>
          </div>

          <p className="text-xs text-slate-500">
            Accedi con <strong>{profile?.email}</strong>. L&apos;indirizzo non si cambia da qui.
          </p>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={status === "saving"}>
              {status === "saving" ? "Salvataggio…" : "Salva"}
            </button>
            {status === "saved" && <span className="text-sm text-accentSoft">Profilo salvato.</span>}
          </div>
        </form>
      )}

      {session && (
        <section className="card mt-5">
          <h2 className="text-base font-semibold">Notifiche</h2>
          <p className="mb-4 mt-1 text-sm text-slate-400">
            Senza email, è l&apos;unico modo per sapere che è successo
            qualcosa senza aprire l&apos;app.
          </p>
          <PushToggle audience={isAdmin ? "coach" : "student"} />
        </section>
      )}

      {session && (
        <section className="card mt-5">
          <h2 className="text-base font-semibold">Password</h2>
          <p className="mb-4 mt-1 text-sm text-slate-400">
            Se te ne ha data una provvisoria un coach, cambiala qui: finché
            non lo fai, quella password la conosce anche lui.
          </p>
          <ChangePassword />
        </section>
      )}
    </main>
  );
}
