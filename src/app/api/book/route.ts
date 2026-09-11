import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { bookingErrorMessage } from "@/lib/errors";
import { notifyNewBooking } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  slot_id?: string;
  day?: string;
  full_name?: string;
  birth_date?: string;
  email?: string;
  phone?: string;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  notes?: string | null;
};

type BookTrialResult = {
  booking_id: string;
  cancel_token: string;
  day: string;
  start_time: string;
  end_time: string;
  coach_name: string;
  age: number;
  guardian_required: boolean;
};

/**
 * La prenotazione passa dal server cosi' la notifica al coach parte
 * comunque, anche se l'utente chiude la pagina subito dopo l'invio.
 * Le regole restano applicate dal database: qui non si valida nulla.
 */
export async function POST(request: Request) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Servizio non configurato." }, { status: 500 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("book_trial", {
    p_slot_id: payload.slot_id,
    p_day: payload.day,
    p_full_name: payload.full_name,
    p_birth_date: payload.birth_date,
    p_email: payload.email,
    p_phone: payload.phone,
    p_guardian_name: payload.guardian_name || null,
    p_guardian_phone: payload.guardian_phone || null,
    p_notes: payload.notes || null,
  });

  if (error) {
    return NextResponse.json({ error: bookingErrorMessage(error) }, { status: 400 });
  }

  const booking = ((data as BookTrialResult[]) ?? [])[0];
  if (!booking) {
    return NextResponse.json({ error: "Prenotazione non riuscita." }, { status: 400 });
  }

  await notifyNewBooking({
    full_name: payload.full_name ?? "",
    age: booking.age,
    day: booking.day,
    start_time: booking.start_time,
    end_time: booking.end_time,
    coach_name: booking.coach_name,
    email: payload.email ?? "",
    phone: payload.phone ?? "",
    guardian_name: booking.guardian_required ? payload.guardian_name ?? null : null,
    guardian_phone: booking.guardian_required ? payload.guardian_phone ?? null : null,
    notes: payload.notes ?? null,
  });

  return NextResponse.json({ booking });
}
