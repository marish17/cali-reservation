-- =====================================================================
-- Il coach può annullare una prova già confermata (imprevisti), e la
-- decisione riporta anche il telefono, per avvisare la persona quando
-- l'email non è disponibile.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- Il tipo restituito cambia (arriva il telefono), quindi la vecchia
-- versione va rimossa prima di ricrearla.
drop function if exists public.decide_booking(uuid, text, text);

create or replace function public.decide_booking(
  p_booking_id uuid,
  p_status     text,
  p_note       text default null
)
returns table (
  booking_id uuid,
  email      text,
  phone      text,
  full_name  text,
  day        date,
  start_time time,
  end_time   time,
  status     text,
  note       text
)
language plpgsql security definer set search_path = public as $$
declare v public.bookings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if p_status not in ('approved', 'rejected', 'cancelled') then
    raise exception 'INVALID_STATUS' using hint = 'Stato non valido.';
  end if;

  select * into v from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Prenotazione non trovata.';
  end if;
  if v.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED' using hint = 'Questa prenotazione è già annullata.';
  end if;

  update public.bookings
     set status = p_status,
         decided_at = now(),
         decided_by = auth.uid(),
         decision_note = nullif(btrim(coalesce(p_note, '')), ''),
         -- Annullando, il posto torna libero: la data serve a
         -- distinguere un annullamento della palestra da una disdetta
         -- della persona.
         cancelled_at = case when p_status = 'cancelled' then now() else v.cancelled_at end
   where id = v.id
  returning * into v;

  return query
  select v.id, v.email, v.phone, v.full_name, v.day, v.start_time, v.end_time,
         v.status, v.decision_note;
end;
$$;

revoke all on function public.decide_booking(uuid, text, text) from public;
grant execute on function public.decide_booking(uuid, text, text) to authenticated;
