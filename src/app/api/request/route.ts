import { NextResponse } from "next/server";
import { bearerToken, createUserClient } from "@/lib/supabase-server";
import { bookingErrorMessage } from "@/lib/errors";
import { notifyNewRequest } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  slot_id?: string;
  day?: string;
  full_name?: string;
  birth_date?: string;
  phone?: string;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  notes?: string | null;
};

type RequestTrialResult = {
  booking_id: string;
  cancel_token: string;
  day: string;
  start_time: string;
  end_time: string;
  coach_name: string;
  age: number;
  guardian_required: boolean;
  status: string;
};

/**
 * La richiesta passa dal server cosi' l'avviso al coach parte comunque,
 * anche se l'utente chiude la pagina subito dopo l'invio, e la chiave
 * del servizio email non arriva mai al browser.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Accedi per richiedere una prova." }, { status: 401 });
  }

  const supabase = createUserClient(token);
  if (!supabase) {
    return NextResponse.json({ error: "Servizio non configurato." }, { status: 500 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? "";

  const { data, error } = await supabase.rpc("request_trial", {
    p_slot_id: payload.slot_id,
    p_day: payload.day,
    p_full_name: payload.full_name,
    p_birth_date: payload.birth_date,
    p_phone: payload.phone,
    p_guardian_name: payload.guardian_name || null,
    p_guardian_phone: payload.guardian_phone || null,
    p_notes: payload.notes || null,
  });

  if (error) {
    return NextResponse.json({ error: bookingErrorMessage(error) }, { status: 400 });
  }

  const booking = ((data as RequestTrialResult[]) ?? [])[0];
  if (!booking) {
    return NextResponse.json({ error: "Richiesta non riuscita." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  await notifyNewRequest({
    full_name: payload.full_name ?? "",
    age: booking.age,
    day: booking.day,
    start_time: booking.start_time,
    end_time: booking.end_time,
    email,
    phone: payload.phone ?? "",
    guardian_name: booking.guardian_required ? payload.guardian_name ?? null : null,
    guardian_phone: booking.guardian_required ? payload.guardian_phone ?? null : null,
    notes: payload.notes ?? null,
    adminUrl: `${origin}/admin`,
  });

  return NextResponse.json({ booking });
}
