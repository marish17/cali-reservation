type SupabaseEnv = { url: string; anonKey: string };

/**
 * Le variabili arrivano da un file scritto a mano: vanno trattate come
 * input non attendibile. Un URL senza schema o incollato a meta' deve
 * portare alla schermata di setup, non a un errore 500.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }

  return { url, anonKey };
}
