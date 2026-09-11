-- =====================================================================
-- Account per chi prenota + approvazione del coach
-- Esegui DOPO 0001_init.sql e 0002_age_and_guardian.sql.
--
-- ATTENZIONE: azzera le prenotazioni esistenti. Erano prove senza
-- account e non hanno modo di essere ricondotte a un utente.
-- =====================================================================

delete from public.bookings;

-- ---------------------------------------------------------------------
-- Profilo di chi prenota: si compila una volta e si riusa.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text,
  full_name      text,
  birth_date     date,
  phone          text,
  guardian_name  text,
  guardian_phone text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists profiles_own_write on public.profiles;
create policy profiles_own_write on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Prenotazioni: ora appartengono a un utente e nascono "in attesa".
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists user_id       uuid references auth.users(id) on delete cascade;
alter table public.bookings add column if not exists decided_at    timestamptz;
alter table public.bookings add column if not exists decided_by    uuid references auth.users(id) on delete set null;
alter table public.bookings add column if not exists decision_note text;

alter table public.bookings alter column user_id set not null;
alter table public.bookings alter column status  set default 'pending';

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

-- Un posto e' occupato da una richiesta in attesa esattamente come da
-- una approvata: il coach non deve mai trovarsi a doverne rifiutare
-- una per mancanza di spazio che aveva gia' promesso.
create or replace function public.is_active_status(p_status text)
returns boolean language sql immutable as $$
  select p_status in ('pending', 'approved');
$$;

drop index if exists public.bookings_one_per_email_per_day;
create unique index if not exists bookings_one_active_per_user_per_day
  on public.bookings (day, user_id) where status in ('pending', 'approved');

drop index if exists public.bookings_day_idx;
drop index if exists public.bookings_slot_idx;
create index if not exists bookings_day_active_idx
  on public.bookings (day) where status in ('pending', 'approved');
create index if not exists bookings_slot_active_idx
  on public.bookings (slot_id, day) where status in ('pending', 'approved');
create index if not exists bookings_user_idx on public.bookings (user_id);

drop policy if exists bookings_own_read on public.bookings;
create policy bookings_own_read on public.bookings
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Disponibilita': conta in attesa + approvate.
-- ---------------------------------------------------------------------
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
    where public.is_active_status(b.status) and b.day between p_from and p_to
    group by b.slot_id, b.day
  ),
  day_counts as (
    select b.day, count(*)::int as n
    from public.bookings b
    where public.is_active_status(b.status) and b.day between p_from and p_to
    group by b.day
  )
  select
    sd.day, sd.slot_id, sd.coach_id, sd.coach_name, sd.start_time, sd.end_time,
    sd.capacity,
    coalesce(sc.n, 0),
    coalesce(dc.n, 0),
    greatest(s.max_trials_per_day - coalesce(dc.n, 0), 0),
    greatest(least(sd.capacity - coalesce(sc.n, 0), s.max_trials_per_day - coalesce(dc.n, 0)), 0)
  from slot_days sd
  left join slot_counts sc on sc.slot_id = sd.slot_id and sc.day = sd.day
  left join day_counts  dc on dc.day = sd.day
  order by sd.day, sd.start_time, sd.coach_name;
end;
$$;

revoke all on function public.get_availability(date, date) from public;
grant execute on function public.get_availability(date, date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Richiesta di prova. Sostituisce book_trial: ora serve un account,
-- e la richiesta nasce in attesa di approvazione.
-- ---------------------------------------------------------------------
drop function if exists public.book_trial(uuid, date, text, date, text, text, text, text, text);

create or replace function public.request_trial(
  p_slot_id        uuid,
  p_day            date,
  p_full_name      text,
  p_birth_date     date,
  p_phone          text,
  p_guardian_name  text default null,
  p_guardian_phone text default null,
  p_notes          text default null
)
returns table (
  booking_id        uuid,
  cancel_token      uuid,
  day               date,
  start_time        time,
  end_time          time,
  coach_name        text,
  age               int,
  guardian_required boolean,
  status            text
)
language plpgsql security definer set search_path = public as $$
declare
  s          public.settings%rowtype;
  v_slot     record;
  v_user     uuid := auth.uid();
  v_email    text;
  v_name     text := btrim(coalesce(p_full_name, ''));
  v_phone    text := btrim(coalesce(p_phone, ''));
  v_gname    text := nullif(btrim(coalesce(p_guardian_name, '')), '');
  v_gphone   text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
  v_age      int;
  v_needs_guardian boolean;
  v_day_n    int;
  v_slot_n   int;
  v_booking  public.bookings%rowtype;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per richiedere una prova.';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;

  select * into s from public.settings where id;

  if length(v_name) < 2 or position(' ' in v_name) = 0 then
    raise exception 'INVALID_NAME' using hint = 'Inserisci nome e cognome.';
  end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'INVALID_PHONE' using hint = 'Inserisci un numero di telefono valido.';
  end if;
  if length(coalesce(v_notes, '')) > 500 then
    raise exception 'NOTES_TOO_LONG' using hint = 'Le note sono troppo lunghe.';
  end if;

  if p_birth_date is null then
    raise exception 'INVALID_BIRTH_DATE' using hint = 'Inserisci la data di nascita.';
  end if;
  if p_birth_date > public.app_today() or p_birth_date < public.app_today() - interval '100 years' then
    raise exception 'INVALID_BIRTH_DATE' using hint = 'La data di nascita non è valida.';
  end if;

  v_age := public.age_at(p_birth_date, p_day);

  if v_age < s.min_age then
    raise exception 'AGE_TOO_LOW'
      using hint = format('Per partecipare bisogna avere almeno %s anni.', s.min_age);
  end if;

  v_needs_guardian := v_age < s.guardian_required_under_age;

  if v_needs_guardian then
    if v_gname is null or position(' ' in v_gname) = 0 then
      raise exception 'GUARDIAN_REQUIRED'
        using hint = format(
          'Sotto i %s anni serve nome e cognome del genitore o tutore che accompagna.',
          s.guardian_required_under_age
        );
    end if;
    if v_gphone is null or length(regexp_replace(v_gphone, '[^0-9]', '', 'g')) < 8 then
      raise exception 'GUARDIAN_PHONE_REQUIRED'
        using hint = 'Inserisci un recapito telefonico del genitore o tutore.';
    end if;
  else
    v_gname  := null;
    v_gphone := null;
  end if;

  -- Il profilo si compila una volta sola: le prossime richieste
  -- partono gia' precompilate.
  insert into public.profiles (user_id, email, full_name, birth_date, phone,
                               guardian_name, guardian_phone, updated_at)
  values (v_user, v_email, v_name, p_birth_date, v_phone, v_gname, v_gphone, now())
  on conflict (user_id) do update
    set email = excluded.email, full_name = excluded.full_name,
        birth_date = excluded.birth_date, phone = excluded.phone,
        guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone,
        updated_at = now();

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
  from public.bookings b where b.day = p_day and public.is_active_status(b.status);

  if v_day_n >= s.max_trials_per_day then
    raise exception 'DAY_FULL' using hint = 'Le prove disponibili per questo giorno sono esaurite.';
  end if;

  select count(*)::int into v_slot_n
  from public.bookings b
  where b.slot_id = p_slot_id and b.day = p_day and public.is_active_status(b.status);

  if v_slot_n >= v_slot.capacity then
    raise exception 'SLOT_FULL' using hint = 'Questo orario e'' appena stato occupato.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.day = p_day and b.user_id = v_user and public.is_active_status(b.status)
  ) then
    raise exception 'ALREADY_BOOKED' using hint = 'Hai gia'' una richiesta attiva per questa data.';
  end if;

  insert into public.bookings (slot_id, coach_id, day, start_time, end_time,
                               full_name, birth_date, email, phone,
                               guardian_name, guardian_phone, notes,
                               user_id, status)
  values (p_slot_id, v_slot.coach_id, p_day, v_slot.start_time, v_slot.end_time,
          v_name, p_birth_date, v_email, v_phone, v_gname, v_gphone, v_notes,
          v_user, 'pending')
  returning * into v_booking;

  return query
  select v_booking.id, v_booking.cancel_token, v_booking.day,
         v_booking.start_time, v_booking.end_time, v_slot.coach_name,
         v_age, v_needs_guardian, v_booking.status;
end;
$$;

revoke all on function
  public.request_trial(uuid, date, text, date, text, text, text, text) from public;
grant execute on function
  public.request_trial(uuid, date, text, date, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Decisione del coach. Restituisce quanto serve per avvisare l'utente.
-- ---------------------------------------------------------------------
create or replace function public.decide_booking(
  p_booking_id uuid,
  p_status     text,
  p_note       text default null
)
returns table (
  booking_id uuid,
  email      text,
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
  if p_status not in ('approved', 'rejected') then
    raise exception 'INVALID_STATUS' using hint = 'Stato non valido.';
  end if;

  select * into v from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Prenotazione non trovata.';
  end if;
  if v.status = 'cancelled' then
    raise exception 'ALREADY_CANCELLED' using hint = 'La richiesta è stata annullata dall''utente.';
  end if;

  update public.bookings
     set status = p_status,
         decided_at = now(),
         decided_by = auth.uid(),
         decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = v.id
  returning * into v;

  return query
  select v.id, v.email, v.full_name, v.day, v.start_time, v.end_time,
         v.status, v.decision_note;
end;
$$;

revoke all on function public.decide_booking(uuid, text, text) from public;
grant execute on function public.decide_booking(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Annullamento da parte dell'utente (dalla sua area o dal link email).
-- ---------------------------------------------------------------------
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns table (status text)
language plpgsql security definer set search_path = public as $$
declare v public.bookings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per annullare la richiesta.';
  end if;

  select * into v from public.bookings b
   where b.id = p_booking_id and b.user_id = auth.uid() for update;

  if not found then
    raise exception 'NOT_FOUND' using hint = 'Prenotazione non trovata.';
  end if;

  if public.is_active_status(v.status) then
    update public.bookings
       set status = 'cancelled', cancelled_at = now()
     where id = v.id
    returning * into v;
  end if;

  return query select v.status;
end;
$$;

revoke all on function public.cancel_my_booking(uuid) from public;
grant execute on function public.cancel_my_booking(uuid) to authenticated;

-- Il link di disdetta via email resta valido anche senza sessione.
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

  if public.is_active_status(v.status) then
    update public.bookings
       set status = 'cancelled', cancelled_at = now()
     where id = v.id
    returning * into v;
  end if;

  return query select v.day, v.start_time, v.full_name, v.status;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to anon, authenticated;
