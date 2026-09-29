"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import SignIn from "@/components/SignIn";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { bookingErrorMessage } from "@/lib/errors";
import { resizeToSquare } from "@/lib/resizeImage";

type Profile = { display_name: string | null; avatar_path: string | null; email: string | null };

export default function ProfileView() {
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.rpc("get_my_profile");
    const row = ((data as Profile[]) ?? [])[0] ?? null;
    setProfile(row);
    setName(row?.display_name ?? "");
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
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
      <div className="mb-8 border-b border-line pb-3">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← Torna alla home
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Il mio profilo</h1>
      <p className="mt-2 text-sm text-slate-400">
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
    </main>
  );
}
