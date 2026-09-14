-- =====================================================================
-- Il database chiama da sé la funzione di invio, senza passare dai
-- Database Webhooks (che richiedono un'infrastruttura non presente su
-- tutti i progetti).
-- Esegui DOPO 0009_push_notifications.sql.
-- =====================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- Configurazione riservata: indirizzo della funzione e parola d'ordine
-- condivisa. RLS attiva e nessuna policy, quindi né il pubblico né gli
-- utenti autenticati possono leggerla; ci arrivano solo le funzioni
-- security definer e la chiave di servizio.
-- ---------------------------------------------------------------------
create table if not exists public.private_config (
  key   text primary key,
  value text not null
);

alter table public.private_config enable row level security;
revoke all on table public.private_config from anon, authenticated;

-- ---------------------------------------------------------------------
-- Inoltro dell'evento. Non aspetta la risposta: una notifica che non
-- parte non deve far fallire una prenotazione.
-- ---------------------------------------------------------------------
create or replace function public.push_notify(p_booking_id uuid, p_audience text)
returns void
language plpgsql security definer set search_path = public, net as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from public.private_config where key = 'push_function_url';
  select value into v_secret from public.private_config where key = 'push_secret';

  -- Finché non è configurato, il sito funziona lo stesso: semplicemente
  -- non spedisce niente.
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-push-secret', v_secret
               ),
    body    := jsonb_build_object(
                 'booking_id', p_booking_id,
                 'audience',   p_audience
               ),
    timeout_milliseconds := 5000
  );
exception when others then
  -- Un guasto nell'invio non può impedire di prenotare.
  raise warning 'push_notify fallita: %', sqlerrm;
end;
$$;

revoke all on function public.push_notify(uuid, text) from public;

-- ---------------------------------------------------------------------
-- Gli inneschi
-- ---------------------------------------------------------------------
create or replace function public.on_booking_created()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public.push_notify(new.id, 'coaches');
  end if;
  return new;
end;
$$;

create or replace function public.on_booking_decided()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Solo un vero cambio di stato, e solo verso un esito: la disdetta
  -- fatta dalla persona stessa non le va annunciata.
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected', 'cancelled')
     and new.decided_at is not null then
    perform public.push_notify(new.id, 'booker');
  end if;
  return new;
end;
$$;

drop trigger if exists booking_created_push on public.bookings;
create trigger booking_created_push
  after insert on public.bookings
  for each row execute function public.on_booking_created();

drop trigger if exists booking_decided_push on public.bookings;
create trigger booking_decided_push
  after update of status on public.bookings
  for each row execute function public.on_booking_decided();
