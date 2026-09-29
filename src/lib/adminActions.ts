"use client";

import { supabase } from "@/lib/supabase";
import { readSupabaseEnv } from "@/lib/env";

/**
 * Le due operazioni che passano dalla funzione `admin` invece che dal
 * database: rimettere una password e cancellare un account. Richiedono
 * la chiave di servizio, che nel browser non può stare.
 *
 * I controlli veri (chi chiama è un coach, il bersaglio non è un altro
 * coach) stanno dentro la funzione. Qui si traducono solo le risposte.
 */

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessione scaduta. Esci e rientra.",
  NOT_ALLOWED: "Operazione riservata ai coach.",
  NOT_ON_YOURSELF:
    "Su te stesso no: la tua password si cambia dal tuo profilo.",
  TARGET_IS_COACH:
    "Questa persona è un coach. La password di un coach si cambia dalla dashboard di Supabase, non da qui.",
  NOT_FOUND: "Account non trovato.",
  RESET_FAILED: "Non è stato possibile cambiare la password.",
  DELETE_FAILED: "Non è stato possibile cancellare l'account.",
  UNKNOWN_ACTION: "Operazione sconosciuta.",
};

async function call(action: string, userId: string): Promise<Record<string, unknown>> {
  const env = readSupabaseEnv();
  if (!env) throw new Error("Configurazione mancante.");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(MESSAGES.NOT_AUTHENTICATED);

  let response: Response;
  try {
    response = await fetch(`${env.url}/functions/v1/admin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ action, user_id: userId }),
    });
  } catch {
    // Quasi sempre vuol dire che la funzione non è stata pubblicata:
    // dirlo è più utile di un generico "errore di rete".
    throw new Error(
      "Non riesco a contattare il server. Controlla di aver pubblicato la funzione «admin» su Supabase."
    );
  }

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.error === "string" ? body.error : "";
    if (response.status === 404) {
      throw new Error(
        "La funzione «admin» non è pubblicata su Supabase. Vedi supabase/functions/admin/SETUP.md."
      );
    }
    throw new Error(MESSAGES[code] ?? "Non è stato possibile completare l'operazione.");
  }
  return body;
}

/** Restituisce la password provvisoria da leggere alla persona. */
export async function resetPassword(userId: string): Promise<string> {
  const body = await call("reset_password", userId);
  return String(body.password ?? "");
}

export async function deleteAccount(userId: string): Promise<void> {
  await call("delete_account", userId);
}
