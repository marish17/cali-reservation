// Funzione di invio delle notifiche push.
//
// Viene chiamata dai Database Webhooks di Supabase quando nasce una
// prenotazione o quando ne cambia lo stato. Sta qui e non nel sito
// perché spedire richiede una chiave privata, che nel browser sarebbe
// alla portata di chiunque.
//
// Deploy:  supabase functions deploy push
// Segreti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

type Booking = { id: string; status: string };
type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Booking | null;
  old_record: Booking | null;
};

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

/** Chi va avvisato, in base a cosa è successo alla prenotazione. */
function audienceFor(payload: WebhookPayload): "coaches" | "booker" | null {
  if (payload.table !== "bookings" || !payload.record) return null;

  if (payload.type === "INSERT") {
    return payload.record.status === "pending" ? "coaches" : null;
  }

  if (payload.type === "UPDATE") {
    const before = payload.old_record?.status;
    const after = payload.record.status;
    if (before === after) return null;
    // L'utente che disdice da solo sa già di averlo fatto.
    return ["approved", "rejected", "cancelled"].includes(after) ? "booker" : null;
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const audience = audienceFor(payload);
  if (!audience || !payload.record) {
    return Response.json({ skipped: true });
  }

  const { data, error } = await supabase.rpc("push_targets_for_booking", {
    p_booking_id: payload.record.id,
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
            tag: audience === "coaches" ? "richieste" : `esito-${payload.record!.id}`,
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
