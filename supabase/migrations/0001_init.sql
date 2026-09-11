-- =====================================================================
-- Calisthenics trial booking - schema, security policies, booking logic
-- Esegui questo file nel SQL Editor di Supabase (una volta sola).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Fuso orario dell'applicazione. Tutte le date/ore sono "orario locale
-- palestra": niente conversioni UTC lato client, niente sorprese.
-- ---------------------------------------------------------------------
create or replace function public.app_now()
returns timestamp
language sql stable as $$
  select (now() at time zone 'Europe/Rome')::timestamp;
$$;

create or replace function public.app_today()
returns date
language sql stable as $$
  select (public.app_now())::date;
$$;

-- ---------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------

-- Impostazioni globali (riga singola)
create table if not exists public.settings (
  id                   boolean primary key default true check (id),
  gym_name             text    not null default 'Calisthenics Club',
  intro_text           text    not null default 'Prenota la tua prova gratuita: scegli il giorno e l''orario con il coach.',
  max_trials_per_day   int     not null default 3  check (max_trials_per_day >= 0),
  booking_horizon_days int     not null default 30 check (booking_horizon_days between 1 and 365),
  min_notice_hours     int     not null default 4  check (min_notice_hours between 0 and 168),
  contact_email        text,
  contact_phone        text,
  updated_at           timestamptz not null default now()
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

-- Coach
create table if not exists public.coaches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Fasce di presenza ricorrenti del coach.
-- weekday: 0 = domenica ... 6 = sabato (coerente con extract(dow)).
create table if not exists public.weekly_slots (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.coaches(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  capacity   int  not null default 2 check (capacity >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  constraint weekly_slots_time_order check (end_time > start_time),
  constraint weekly_slots_unique unique (coach_id, weekday, start_time)
);

create index if not exists weekly_slots_weekday_idx on public.weekly_slots (weekday) where active;

-- Chiusure straordinarie / festivita'
create table if not exists public.closures (
  id     uuid primary key default gen_random_uuid(),
  day    date not null unique,
  reason text
);

-- Prenotazioni
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references public.weekly_slots(id) on delete restrict,
  coach_id     uuid not null references public.coaches(id) on delete restrict,
  day          date not null,
  start_time   time not null,
  end_time     time not null,
  full_name    text not null,
  email        text not null,
  phone        text not null,
  notes        text,
  status       text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  cancel_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists bookings_day_idx on public.bookings (day) where status = 'confirmed';
create index if not exists bookings_slot_idx on public.bookings (slot_id, day) where status = 'confirmed';
create unique index if not exists bookings_cancel_token_idx on public.bookings (cancel_token);

-- Una sola prova attiva per email nello stesso giorno.
create unique index if not exists bookings_one_per_email_per_day
  on public.bookings (day, lower(email)) where status = 'confirmed';

-- Amministratori: chi compare qui puo' gestire il pannello.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Il pubblico non legge/scrive MAI direttamente queste tabelle: passa
-- solo dalle funzioni SECURITY DEFINER in fondo al file.
-- ---------------------------------------------------------------------

alter table public.settings     enable row level security;
alter table public.coaches      enable row level security;
alter table public.weekly_slots enable row level security;
alter table public.closures     enable row level security;
alter table public.bookings     enable row level security;
alter table public.admins       enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array['settings', 'coaches', 'weekly_slots', 'closures', 'bookings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t
    );
  end loop;
end $$;

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- API pubblica
-- ---------------------------------------------------------------------

-- Dati vetrina (nome palestra, testo intro, contatti).
create or replace function public.get_public_settings()
returns table (
  gym_name             text,
  intro_text           text,
  booking_horizon_days int,
  min_notice_hours     int,
  max_trials_per_day   int,
  contact_email        text,
  contact_phone        text
)
language sql stable security definer set search_path = public as $$
  select s.gym_name, s.intro_text, s.booking_horizon_days, s.min_notice_hours,
         s.max_trials_per_day, s.contact_email, s.contact_phone
  from public.settings s where s.id;
$$;

-- Disponibilita' reale giorno per giorno.
-- "remaining" tiene gia' conto sia della capienza dello slot sia del
-- tetto massimo di prove giornaliere.
create or replace function public.get_availability(p_from date, p_to date)
returns table (
  day            date,
  slot_id        uuid,
  coach_id       uuid,
  coach_name     text,
  start_time     time,
  end_time       time,
  capacity       int,
  booked         int,
  day_booked     int,
  day_remaining  int,
  remaining      int
)
language plpgsql stable security definer set search_path = public as $$
declare
  s          public.settings%rowtype;
  v_earliest timestamp;
begin
  select * into s from public.settings where id;

  p_from := greatest(p_from, public.app_today());
  p_to   := least(p_to, public.app_today() + s.booking_horizon_days);
  if p_to < p_from then
    return;
  end if;

  v_earliest := public.app_now() + make_interval(hours => s.min_notice_hours);

  return query
  with days as (
    select d::date as day
    from generate_series(p_from, p_to, interval '1 day') d
    where not exists (select 1 from public.closures c where c.day = d::date)
  ),
  slot_days as (
    select days.day, ws.id as slot_id, ws.coach_id, c.name as coach_name,
           ws.start_time, ws.end_time, ws.capacity
    from days
    join public.weekly_slots ws
      on ws.weekday = extract(dow from days.day)::smallint
     and ws.active
    join public.coaches c on c.id = ws.coach_id and c.active
    where (days.day + ws.start_time) >= v_earliest
  ),
  slot_counts as (
    select b.slot_id, b.day, count(*)::int as n
    from public.bookings b
    where b.status = 'confirmed' and b.day between p_from and p_to
    group by b.slot_id, b.day
  ),
  day_counts as (
    select b.day, count(*)::int as n
    from public.bookings b
    where b.status = 'confirmed' and b.day between p_from and p_to
    group by b.day
  )
  select
    sd.day,
    sd.slot_id,
    sd.coach_id,
    sd.coach_name,
    sd.start_time,
    sd.end_time,
    sd.capacity,
    coalesce(sc.n, 0)                                  as booked,
    coalesce(dc.n, 0)                                  as day_booked,
    greatest(s.max_trials_per_day - coalesce(dc.n, 0), 0) as day_remaining,
    greatest(
      least(sd.capacity - coalesce(sc.n, 0), s.max_trials_per_day - coalesce(dc.n, 0)),
      0
    )                                                  as remaining
  from slot_days sd
  left join slot_counts sc on sc.slot_id = sd.slot_id and sc.day = sd.day
  left join day_counts  dc on dc.day = sd.day
  order by sd.day, sd.start_time, sd.coach_name;
end;
$$;

-- Prenotazione. Tutti i controlli sono qui dentro: il client non e'
-- una fonte attendibile. Il lock per-giorno serializza le richieste
-- concorrenti sullo stesso giorno, cosi' il tetto giornaliero e la
-- capienza dello slot non possono essere superati da due richieste
-- simultanee.
create or replace function public.book_trial(
  p_slot_id   uuid,
  p_day       date,
  p_full_name text,
  p_email     text,
  p_phone     text,
  p_notes     text default null
)
returns table (
  booking_id   uuid,
  cancel_token uuid,
  day          date,
  start_time   time,
  end_time     time,
  coach_name   text
)
language plpgsql security definer set search_path = public as $$
declare
  s          public.settings%rowtype;
  v_slot     record;
  v_name     text := btrim(coalesce(p_full_name, ''));
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_phone    text := btrim(coalesce(p_phone, ''));
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
  v_day_n    int;
  v_slot_n   int;
  v_booking  public.bookings%rowtype;
begin
  if length(v_name) < 2 then
    raise exception 'INVALID_NAME' using hint = 'Inserisci nome e cognome.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'INVALID_EMAIL' using hint = 'Inserisci un indirizzo email valido.';
  end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'INVALID_PHONE' using hint = 'Inserisci un numero di telefono valido.';
  end if;
  if length(coalesce(v_notes, '')) > 500 then
    raise exception 'NOTES_TOO_LONG' using hint = 'Le note sono troppo lunghe.';
  end if;

  select * into s from public.settings where id;

  -- Serializza le prenotazioni dello stesso giorno.
  perform pg_advisory_xact_lock(hashtext('booking:' || p_day::text));

  select ws.id, ws.coach_id, ws.start_time, ws.end_time, ws.capacity,
         ws.weekday, c.name as coach_name
    into v_slot
  from public.weekly_slots ws
  join public.coaches c on c.id = ws.coach_id and c.active
  where ws.id = p_slot_id and ws.active;

  if not found then
    raise exception 'SLOT_NOT_FOUND' using hint = 'Questo orario non e'' piu'' disponibile.';
  end if;
  if v_slot.weekday <> extract(dow from p_day)::smallint then
    raise exception 'SLOT_WRONG_DAY' using hint = 'L''orario scelto non esiste in questa data.';
  end if;
  if exists (select 1 from public.closures cl where cl.day = p_day) then
    raise exception 'DAY_CLOSED' using hint = 'La palestra e'' chiusa in questa data.';
  end if;
  if p_day > public.app_today() + s.booking_horizon_days then
    raise exception 'TOO_FAR' using hint = 'Non e'' ancora possibile prenotare cosi'' in la'' nel tempo.';
  end if;
  if (p_day + v_slot.start_time) < public.app_now() + make_interval(hours => s.min_notice_hours) then
    raise exception 'TOO_LATE'
      using hint = format('Le prenotazioni chiudono %s ore prima dell''inizio.', s.min_notice_hours);
  end if;

  select count(*)::int into v_day_n
  from public.bookings b where b.day = p_day and b.status = 'confirmed';

  if v_day_n >= s.max_trials_per_day then
    raise exception 'DAY_FULL' using hint = 'Le prove disponibili per questo giorno sono esaurite.';
  end if;

  select count(*)::int into v_slot_n
  from public.bookings b
  where b.slot_id = p_slot_id and b.day = p_day and b.status = 'confirmed';

  if v_slot_n >= v_slot.capacity then
    raise exception 'SLOT_FULL' using hint = 'Questo orario e'' appena stato occupato.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.day = p_day and lower(b.email) = v_email and b.status = 'confirmed'
  ) then
    raise exception 'ALREADY_BOOKED' using hint = 'Risulta gia'' una prenotazione con questa email in questa data.';
  end if;

  insert into public.bookings (slot_id, coach_id, day, start_time, end_time,
                               full_name, email, phone, notes)
  values (p_slot_id, v_slot.coach_id, p_day, v_slot.start_time, v_slot.end_time,
          v_name, v_email, v_phone, v_notes)
  returning * into v_booking;

  return query
  select v_booking.id, v_booking.cancel_token, v_booking.day,
         v_booking.start_time, v_booking.end_time, v_slot.coach_name;
end;
$$;

-- Disdetta tramite link personale (nessun login richiesto).
create or replace function public.cancel_booking(p_token uuid)
returns table (
  day        date,
  start_time time,
  full_name  text,
  status     text
)
language plpgsql security definer set search_path = public as $$
declare v public.bookings%rowtype;
begin
  select * into v from public.bookings b where b.cancel_token = p_token for update;

  if not found then
    raise exception 'NOT_FOUND' using hint = 'Prenotazione non trovata.';
  end if;

  if v.status = 'confirmed' then
    update public.bookings
       set status = 'cancelled', cancelled_at = now()
     where id = v.id
    returning * into v;
  end if;

  return query select v.day, v.start_time, v.full_name, v.status;
end;
$$;

-- Sola lettura della propria prenotazione dal link di disdetta.
create or replace function public.get_booking_by_token(p_token uuid)
returns table (
  day        date,
  start_time time,
  end_time   time,
  full_name  text,
  coach_name text,
  status     text
)
language sql stable security definer set search_path = public as $$
  select b.day, b.start_time, b.end_time, b.full_name, c.name, b.status
  from public.bookings b
  join public.coaches c on c.id = b.coach_id
  where b.cancel_token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Permessi: il ruolo anon puo' chiamare solo le funzioni pubbliche.
-- ---------------------------------------------------------------------
revoke all on function public.get_availability(date, date) from public;
revoke all on function public.book_trial(uuid, date, text, text, text, text) from public;
revoke all on function public.cancel_booking(uuid) from public;
revoke all on function public.get_booking_by_token(uuid) from public;
revoke all on function public.get_public_settings() from public;

grant execute on function public.get_public_settings()              to anon, authenticated;
grant execute on function public.get_availability(date, date)       to anon, authenticated;
grant execute on function public.book_trial(uuid, date, text, text, text, text) to anon, authenticated;
grant execute on function public.cancel_booking(uuid)               to anon, authenticated;
grant execute on function public.get_booking_by_token(uuid)         to anon, authenticated;
