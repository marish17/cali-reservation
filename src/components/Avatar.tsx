"use client";

import { supabase } from "@/lib/supabase";

/** Iniziali come ripiego: un cerchio vuoto non dice chi sei. */
function initials(name: string | null, email: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export default function Avatar({
  name,
  email,
  path,
  size = 32,
}: {
  name?: string | null;
  email?: string | null;
  path?: string | null;
  size?: number;
}) {
  const url = avatarUrl(path ?? null);

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white/5 font-semibold text-slate-300"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initials(name ?? null, email ?? null)
      )}
    </span>
  );
}
