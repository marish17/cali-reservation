// Le due operazioni che il pannello non può fare da solo: rimettere la
// password di una persona e cancellarne l'account.
//
// Stanno qui e non nel sito perché richiedono la chiave di servizio,
// quella che può toccare qualunque account. Nel browser sarebbe alla
// portata di chiunque apra gli strumenti di sviluppo.
//
// Deploy:  supabase functions deploy admin
//          (senza --no-verify-jwt: qui il chiamante è una persona, e
//           vogliamo che Supabase ne verifichi il token prima di noi)
//
// Segreti: nessuno da aggiungere. SUPABASE_URL, SUPABASE_ANON_KEY e
//          SUPABASE_SERVICE_ROLE_KEY ci sono già.

import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Parole invece di caratteri a caso: questa password va detta a voce o
// scritta in un messaggio, e "vela-cardo-7231" si trasmette senza
// chiedere tre volte se è una elle o una i maiuscola.
const WORDS = [
  "vela", "cardo", "pino", "sabbia", "onda", "monte", "riva", "faro",
  "lupo", "ramo", "fiume", "neve", "sole", "luna", "corda", "pietra",
];

function temporaryPassword(): string {
  const pick = () => WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
  const digits = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
  return `${pick()}-${pick()}-${digits}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "NOT_AUTHENTICATED" });

  // Chi sta chiamando: il token lo verifica Supabase, non noi.
  const asCaller = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: who } = await asCaller.auth.getUser();
  const caller = who?.user;
  if (!caller) return reply(401, { error: "NOT_AUTHENTICATED" });

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: callerIsAdmin } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (!callerIsAdmin) return reply(403, { error: "NOT_ALLOWED" });

  let body: { action?: string; user_id?: string };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "INVALID_BODY" });
  }

  const target = body.user_id;
  if (!target) return reply(400, { error: "NO_TARGET" });
  if (target === caller.id) {
    // Cambiarsi la password si fa dal proprio profilo, dove serve
    // sapere quella vecchia; cancellarsi l'account da qui sarebbe solo
    // un modo di chiudersi fuori per sbaglio.
    return reply(400, { error: "NOT_ON_YOURSELF" });
  }

  // Un coach non tocca l'account di un altro coach. Senza questo, uno
  // qualunque dei tre può prendersi l'accesso completo di un collega
  // senza che nessuno se ne accorga.
  const { data: targetIsAdmin } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", target)
    .maybeSingle();
  if (targetIsAdmin) return reply(403, { error: "TARGET_IS_COACH" });

  const { data: targetUser } = await admin.auth.admin.getUserById(target);
  if (!targetUser?.user) return reply(404, { error: "NOT_FOUND" });
  const targetEmail = targetUser.user.email ?? null;

  if (body.action === "reset_password") {
    const password = temporaryPassword();

    const { error } = await admin.auth.admin.updateUserById(target, { password });
    if (error) return reply(500, { error: "RESET_FAILED", detail: error.message });

    // L'avviso resta acceso finché la persona non se la cambia: fino a
    // quel momento la sua password la conosce anche il coach.
    await admin
      .from("profiles")
      .upsert(
        { user_id: target, email: targetEmail, password_reset_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    await admin.from("password_resets").insert({
      target_user_id: target,
      target_email: targetEmail,
      by_user_id: caller.id,
      by_email: caller.email ?? null,
    });

    return reply(200, { password });
  }

  if (body.action === "delete_account") {
    // Tutto il resto se ne va da solo: le tabelle puntano a
    // auth.users con on delete cascade.
    const { error } = await admin.auth.admin.deleteUser(target);
    if (error) return reply(500, { error: "DELETE_FAILED", detail: error.message });
    return reply(200, { deleted: true, email: targetEmail });
  }

  return reply(400, { error: "UNKNOWN_ACTION" });
});
