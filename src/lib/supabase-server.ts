import { createClient } from "@supabase/supabase-js";

/**
 * Client anonimo per il rendering lato server (solo dati pubblici).
 * Nessuna sessione da persistere: ogni richiesta e' indipendente.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
