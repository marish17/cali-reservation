-- =====================================================================
-- Notifiche push: registrazione dei dispositivi e destinatari.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- La chiave pubblica sta nelle impostazioni e non fra le variabili
-- d'ambiente: con un sito statico quelle si leggono solo in fase di
-- build, e cambiarle costerebbe una ricostruzione.
alter table public.settings
  add column if not exists vapid_public_key text;

-- ---------------------------------------------------------------------
-- Un dispositivo per riga: la stessa persona può usare telefono e
-- computer, e ognuno ha il proprio recapito.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Nessuno legge i recapiti altrui: chi spedisce è la funzione di invio,
-- che gira con privilegi propri.
drop policy if exists push_own_read on public.push_subscriptions;
create policy push_own_read on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Registrazione e cancellazione del dispositivo.
-- ---------------------------------------------------------------------
create or replace function public.save_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per attivare le notifiche.';
  end if;
  if coalesce(btrim(p_endpoint), '') = '' or coalesce(btrim(p_p256dh), '') = ''
     or coalesce(btrim(p_auth), '') = '' then
    raise exception 'INVALID_SUBSCRIPTION' using hint = 'Dati del dispositivo incompleti.';
  end if;

  -- Lo stesso recapito può cambiare proprietario: un telefono passato a
  -- un'altra persona, o un secondo account sullo stesso browser.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;
  delete from public.push_subscriptions
   where endpoint = btrim(p_endpoint) and user_id = auth.uid();
end;
$$;

-- Quanti dispositivi ha registrato chi sta guardando: serve a dire
-- "attive su questo telefono" invece di lasciarlo nel dubbio.
create or replace function public.my_push_devices()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.push_subscriptions where user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.delete_push_subscription(text) from public;
revoke all on function public.my_push_devices() from public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.my_push_devices() to authenticated;

-- ---------------------------------------------------------------------
-- Destinatari di un evento. Usata dalla funzione di invio, che si
-- autentica con la chiave di servizio: non è esposta al pubblico.
-- ---------------------------------------------------------------------
create or replace function public.push_targets_for_booking(
  p_booking_id uuid,
  p_audience   text
)
returns table (
  endpoint text,
  p256dh   text,
  auth     text,
  title    text,
  body     text,
  url      text
)
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings%rowtype;
  v_when text;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found then
    return;
  end if;

  v_when := to_char(b.day, 'DD/MM') || ' alle ' || to_char(b.start_time, 'HH24:MI');

  if p_audience = 'coaches' then
    -- Una richiesta da approvare: la ricevono tutti i coach.
    return query
    select s.endpoint, s.p256dh, s.auth,
           'Nuova richiesta di prova'::text,
           (b.full_name || ' — ' || v_when)::text,
           '/admin/'::text
    from public.push_subscriptions s
    join public.admins a on a.user_id = s.user_id;

  elsif p_audience = 'booker' then
    -- L'esito: lo riceve solo chi ha prenotato.
    return query
    select s.endpoint, s.p256dh, s.auth,
           (case b.status
              when 'approved'  then 'Prova confermata'
              when 'rejected'  then 'Richiesta non accolta'
              when 'cancelled' then 'Prova annullata'
              else 'Aggiornamento sulla tua richiesta'
            end)::text,
           (case b.status
              when 'approved' then 'Ti aspettiamo il ' || v_when
              else 'Prova del ' || v_when
            end || coalesce(' — ' || b.decision_note, ''))::text,
           '/le-mie-prenotazioni/'::text
    from public.push_subscriptions s
    where s.user_id = b.user_id;
  end if;
end;
$$;

revoke all on function public.push_targets_for_booking(uuid, text) from public;
-- Nessun grant a anon/authenticated: solo la chiave di servizio la usa.

-- ---------------------------------------------------------------------
-- Pulizia dei recapiti che il browser ha buttato via (disinstallazione,
-- permesso revocato). Chiamata dalla funzione di invio quando il
-- servizio push risponde "questo recapito non esiste più".
-- ---------------------------------------------------------------------
create or replace function public.forget_push_endpoint(p_endpoint text)
returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.forget_push_endpoint(text) from public;
