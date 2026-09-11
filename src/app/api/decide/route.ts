import { NextResponse } from "next/server";
import { bearerToken, createUserClient } from "@/lib/supabase-server";
import { bookingErrorMessage } from "@/lib/errors";
import { notifyDecision } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DecideResult = {
  booking_id: string;
  email: string;
  full_name: string;
  day: string;
  start_time: string;
  end_time: string;
  status: "approved" | "rejected" | "cancelled";
  note: string | null;
};

/**
 * Approvazione o rifiuto. Che chi chiama sia davvero un coach lo
 * stabilisce il database (decide_booking controlla is_admin), non
 * questa route: il token viene solo inoltrato.
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

  let payload: { booking_id?: string; status?: string; note?: string | null };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("decide_booking", {
    p_booking_id: payload.booking_id,
    p_status: payload.status,
    p_note: payload.note || null,
  });

  if (error) {
    return NextResponse.json({ error: bookingErrorMessage(error) }, { status: 400 });
  }

  const decision = ((data as DecideResult[]) ?? [])[0];
  if (!decision) {
    return NextResponse.json({ error: "Operazione non riuscita." }, { status: 400 });
  }

  // La decisione e' presa e registrata comunque: se l'avviso non parte,
  // il coach deve saperlo per avvisare la persona a mano.
  const email = await notifyDecision({
    to: decision.email,
    full_name: decision.full_name,
    day: decision.day,
    start_time: decision.start_time,
    end_time: decision.end_time,
    status: decision.status,
    note: decision.note,
  });

  return NextResponse.json({ decision, email });
}
