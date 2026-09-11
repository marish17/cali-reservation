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

/**
 * Client che agisce per conto dell'utente che ha fatto la richiesta:
 * il token arriva dal browser e viene passato a Supabase cosi' com'e',
 * quindi auth.uid() e le policy valgono esattamente come lato client.
 * Un token scaduto o falso non apre nulla: lo verifica Supabase.
 */
export function createUserClient(accessToken: string) {
  const env = readSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Estrae il bearer token dall'header Authorization. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}
