-- =====================================================================
-- I coach diventano persone con un accesso, e possono essere assenti.
--
-- Finora "coach" erano due cose scollegate: le righe che possiedono gli
-- orari (solo nomi) e gli utenti che entrano nel pannello. Nessuno
-- sapeva che erano la stessa persona.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

alter table public.coaches
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Un account può corrispondere a un solo coach.
create unique index if not exists coaches_user_unique
  on public.coaches (user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- Assenze: un periodo in cui un coach non c'è. Un giorno solo è un
-- periodo che inizia e finisce lo stesso giorno.
-- ---------------------------------------------------------------------
create table if not exists public.coach_absences (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.coaches(id) on delete cascade,
  from_day   date not null,
  to_day     date not null,
  reason     text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coach_absences_order check (to_day >= from_day)
);

create index if not exists coach_absences_lookup
  on public.coach_absences (coach_id, from_day, to_day);

alter table public.coach_absences enable row level security;

drop policy if exists coach_absences_admin_all on public.coach_absences;
create policy coach_absences_admin_all on public.coach_absences
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Disponibilità: le fasce di un coach assente spariscono, quelle degli
-- altri restano. Una chiusura toglie tutto, un'assenza toglie una
-- persona: sono due cose diverse.
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
      and not exists (
        select 1 from public.coach_absences a
        where a.coach_id = ws.coach_id
          and days.day between a.from_day and a.to_day
      )
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
-- Prove che resterebbero scoperte. Si guarda PRIMA di segnare
-- l'assenza: annullare da soli una cosa promessa a qualcuno non è
-- una decisione che spetta al software.
-- ---------------------------------------------------------------------
create or replace function public.bookings_covered_by_coach(
  p_coach_id uuid,
  p_from     date,
  p_to       date
)
returns table (
  booking_id uuid,
  day        date,
  start_time time,
  end_time   time,
  full_name  text,
  phone      text,
  email      text,
  status     text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  select b.id, b.day, b.start_time, b.end_time, b.full_name, b.phone, b.email, b.status
  from public.bookings b
  where b.coach_id = p_coach_id
    and b.day between p_from and p_to
    and public.is_active_status(b.status)
  order by b.day, b.start_time;
end;
$$;

revoke all on function public.bookings_covered_by_coach(uuid, date, date) from public;
grant execute on function public.bookings_covered_by_coach(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Collegare una riga coach a un account.
-- ---------------------------------------------------------------------
create or replace function public.set_coach_user(p_coach_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  if p_user_id is not null and not exists (
    select 1 from public.admins a where a.user_id = p_user_id
  ) then
    raise exception 'NOT_A_COACH'
      using hint = 'Quell''account non ha accesso al pannello: abilitalo prima da Accessi.';
  end if;

  update public.coaches set user_id = p_user_id where id = p_coach_id;
end;
$$;

revoke all on function public.set_coach_user(uuid, uuid) from public;
grant execute on function public.set_coach_user(uuid, uuid) to authenticated;
