import { NextResponse } from "next/server";
import { bearerToken, createUserClient } from "@/lib/supabase-server";
import { parseRecipients, sendTestEmail, notifySender } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostica riservata ai coach. Prova un invio reale e riporta la
 * risposta del servizio parola per parola, invece di lasciare l'errore
 * sepolto nei log. Dice anche se le variabili sono visibili a runtime:
 * su alcune piattaforme si impostano per la build e non per il server,
 * e da fuori le due cose sono indistinguibili.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessione scaduta, accedi di nuovo." }, { status: 401 });
  }

  const supabase = createUserClient(token);
  if (!supabase) {
    return NextResponse.json({ error: "Servizio non configurato." }, { status: 500 });
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) {
    return NextResponse.json({ error: "Operazione riservata ai coach." }, { status: 403 });
  }

  const result = await sendTestEmail();
  const { valid, invalid } = parseRecipients();

  return NextResponse.json({
    ...result,
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
    recipients: valid,
    invalidRecipients: invalid,
    // Il valore grezzo è la cosa che risolve il problema più in fretta:
    // rende visibile una virgoletta o uno spazio di troppo.
    rawRecipients: process.env.NOTIFY_EMAIL ?? "",
    sender: notifySender(),
  });
}
