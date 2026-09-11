"use client";

import { createClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/env";

const env = readSupabaseEnv();

export const isSupabaseConfigured = env !== null;

// Senza configurazione valida l'app deve comunque compilare e mostrare
// la schermata di setup, invece di esplodere al primo import.
export const supabase = createClient(
  env?.url ?? "https://placeholder.supabase.co",
  env?.anonKey ?? "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true } }
);
