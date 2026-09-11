-- =====================================================================
-- Eta' del partecipante, soglia di accompagnamento e notifiche
-- Esegui DOPO 0001_init.sql.
-- =====================================================================

-- Nuove regole configurabili
alter table public.settings
  add column if not exists min_age int not null default 8
    check (min_age between 0 and 99);

alter table public.settings
  add column if not exists guardian_required_under_age int not null default 14
    check (guardian_required_under_age between 0 and 99);

-- L'eta' si ricava dalla data di nascita: non invecchia da sola come
-- un numero digitato a mano, e permette di calcolare l'eta' esatta
-- nel giorno della prova.
alter table public.bookings add column if not exists birth_date     date;
alter table public.bookings add column if not exists guardian_name  text;
alter table public.bookings add column if not exists guardian_phone text;

-- Eta' compiuta a una certa data.
create or replace function public.age_at(p_birth_date date, p_on date)
returns int
language sql immutable as $$
  select date_part('year', age(p_on, p_birth_date))::int;
$$;

-- ---------------------------------------------------------------------
-- Impostazioni pubbliche: il form deve sapere le soglie per guidare
-- l'utente prima ancora di inviare.
-- ---------------------------------------------------------------------
drop function if exists public.get_public_settings();

create or replace function public.get_public_settings()
returns table (
  gym_name                    text,
  intro_text                  text,
  booking_horizon_days        int,
  min_notice_hours            int,
  max_trials_per_day          int,
  min_age                     int,
  guardian_required_under_age int,
  contact_email               text,
  contact_phone               text
)
language sql stable security definer set search_path = public as $$
  select s.gym_name, s.intro_text, s.booking_horizon_days, s.min_notice_hours,
         s.max_trials_per_day, s.min_age, s.guardian_required_under_age,
         s.contact_email, s.contact_phone
  from public.settings s where s.id;
$$;

revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Prenotazione con data di nascita e accompagnatore
-- ---------------------------------------------------------------------
drop function if exists public.book_trial(uuid, date, text, text, text, text);

create or replace function public.book_trial(
  p_slot_id        uuid,
  p_day            date,
  p_full_name      text,
  p_birth_date     date,
  p_email          text,
  p_phone          text,
  p_guardian_name  text default null,
  p_guardian_phone text default null,
  p_notes          text default null
)
returns table (
  booking_id       uuid,
  cancel_token     uuid,
  day              date,
  start_time       time,
  end_time         time,
  coach_name       text,
  age              int,
  guardian_required boolean
)
language plpgsql security definer set search_path = public as $$
declare
  s          public.settings%rowtype;
  v_slot     record;
  v_name     text := btrim(coalesce(p_full_name, ''));
  v_email    text := lower(btrim(coalesce(p_email, '')));
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
  select * into s from public.settings where id;

  if length(v_name) < 2 or position(' ' in v_name) = 0 then
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

  -- Data di nascita ed eta' al giorno della prova
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
    -- Oltre la soglia i dati dell'accompagnatore non si conservano.
    v_gname  := null;
    v_gphone := null;
  end if;

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
                               full_name, birth_date, email, phone,
                               guardian_name, guardian_phone, notes)
  values (p_slot_id, v_slot.coach_id, p_day, v_slot.start_time, v_slot.end_time,
          v_name, p_birth_date, v_email, v_phone, v_gname, v_gphone, v_notes)
  returning * into v_booking;

  return query
  select v_booking.id, v_booking.cancel_token, v_booking.day,
         v_booking.start_time, v_booking.end_time, v_slot.coach_name,
         v_age, v_needs_guardian;
end;
$$;

revoke all on function
  public.book_trial(uuid, date, text, date, text, text, text, text, text) from public;
grant execute on function
  public.book_trial(uuid, date, text, date, text, text, text, text, text) to anon, authenticated;
