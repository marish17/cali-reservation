import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/env";

/**
 * Client anonimo per il rendering lato server (solo dati pubblici).
 * Nessuna sessione da persistere: ogni richiesta e' indipendente.
 */
export function createServerClient() {
  const env = readSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
