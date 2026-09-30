// Funzione di invio delle notifiche push.
//
// La chiama il database quando nasce una prenotazione o quando ne
// cambia lo stato. Sta qui e non nel sito perché spedire richiede una
// chiave privata, che nel browser sarebbe alla portata di chiunque.
//
// Deploy:  supabase functions deploy push --no-verify-jwt
// Segreti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SECRET
//
// Il controllo di chi può chiamarla è la parola d'ordine condivisa col
// database: l'unico potere che dà è far partire una notifica per una
// prenotazione che esiste già.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// `booking_id` è il nome vecchio: il soggetto adesso può essere anche
// una scheda, e il database li manda entrambi durante il passaggio.
type Payload = { subject_id?: string; booking_id?: string; audience?: string };

const AUDIENCES = ["coaches", "booker", "student_new", "student_update"] as const;
type Audience = (typeof AUDIENCES)[number];

// Un avviso che sostituisce il precedente invece di accodarsi: tre
// salvataggi di fila della stessa scheda non devono lasciare tre
// notifiche sul telefono.
function tagFor(audience: Audience, subject: string): string {
  if (audience === "coaches") return "richieste";
  if (audience === "booker") return `esito-${subject}`;
  return `scheda-${subject}`;
}

type Target = {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  url: string;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:prenotazioni@example.it",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expected = Deno.env.get("PUSH_SECRET") ?? "";
  if (!expected || request.headers.get("x-push-secret") !== expected) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const audience = payload.audience as Audience | undefined;
  const subject = payload.subject_id ?? payload.booking_id;
  if (!subject || !audience || !AUDIENCES.includes(audience)) {
    return Response.json({ skipped: true });
  }

  const { data, error } = await supabase.rpc("push_targets", {
    p_subject_id: subject,
    p_audience: audience,
  });

  if (error) {
    console.error("Destinatari non recuperati:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const targets = (data ?? []) as Target[];
  let sent = 0;
  let dropped = 0;

  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify({
            title: target.title,
            body: target.body,
            url: target.url,
            tag: tagFor(audience, subject),
          })
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404 e 410 significano che il recapito non esiste più:
        // tenerlo in tabella produrrebbe errori a ogni invio.
        if (status === 404 || status === 410) {
          await supabase.rpc("forget_push_endpoint", { p_endpoint: target.endpoint });
          dropped++;
        } else {
          console.error("Invio fallito:", status, (err as Error).message);
        }
      }
    })
  );

  return Response.json({ audience, targets: targets.length, sent, dropped });
});
