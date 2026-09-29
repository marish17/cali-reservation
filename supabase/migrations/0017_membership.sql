-- =====================================================================
-- Allievi iscritti, archiviazione, e traccia dei reset di password.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Chi è iscritto non deve vedere il calendario delle prove: la prova
-- l'ha già fatta, o l'ha fatta prima che questa app esistesse. A lui
-- servono la scheda e gli orari del suo coach.
-- ---------------------------------------------------------------------
alter table public.students add column if not exists enrolled boolean not null default false;

-- Una password rimessa dal coach la conosce anche il coach: finché la
-- persona non se la cambia, questa data resta e l'app glielo ricorda.
alter table public.profiles add column if not exists password_reset_at timestamptz;

-- Poter cambiare la password di chiunque, senza che ne resti traccia,
-- non è un potere che si lascia a nessuno.
create table if not exists public.password_resets (
  id             uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete set null,
  target_email   text,
  by_user_id     uuid references auth.users(id) on delete set null,
  by_email       text,
  at             timestamptz not null default now()
);

alter table public.password_resets enable row level security;

drop policy if exists password_resets_admin_read on public.password_resets;
create policy password_resets_admin_read on public.password_resets
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Un'unica funzione per la riga allievo, invece di scrivere sulla
-- tabella dal browser: così le regole stanno in un posto solo.
-- ---------------------------------------------------------------------
create or replace function public.set_student(
  p_user_id  uuid,
  p_coach_id uuid     default null,
  p_enrolled boolean  default null,
  p_active   boolean  default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if p_user_id is null then
    raise exception 'NO_STUDENT' using hint = 'Scegli la persona.';
  end if;

  perform public.ensure_student(p_user_id);

  -- I parametri lasciati nulli non toccano nulla: si cambia una cosa
  -- alla volta senza doverle rimandare tutte.
  update public.students
     set coach_id = coalesce(p_coach_id, coach_id),
         enrolled = coalesce(p_enrolled, enrolled),
         active   = coalesce(p_active, active)
   where user_id = p_user_id;
end;
$$;

-- Staccare il coach assegnato ha bisogno di dire "nessuno", che
-- coalesce non sa distinguere da "non toccare".
create or replace function public.clear_student_coach(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  perform public.ensure_student(p_user_id);
  update public.students set coach_id = null where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cosa sono, per me stesso: decide cosa mostrare aprendo il sito.
-- ---------------------------------------------------------------------
create or replace function public.get_my_membership()
returns table (
  enrolled          boolean,
  coach_id          uuid,
  coach_name        text,
  has_workout       boolean,
  password_reset_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;

  return query
  select coalesce(s.enrolled, false),
         s.coach_id,
         c.name,
         exists (select 1 from public.workouts w
                  where w.student_id = auth.uid() and w.status = 'active'),
         p.password_reset_at
  from (select auth.uid() as uid) me
  left join public.students s on s.user_id = me.uid
  left join public.coaches  c on c.id = s.coach_id and c.active
  left join public.profiles p on p.user_id = me.uid;
end;
$$;

-- Quando trovo il mio coach in palestra. Sono gli stessi orari di
-- presenza su cui si aprono le prove: qui servono a sapere quando
-- c'è, non a prenotare.
create or replace function public.get_my_coach_hours()
returns table (
  coach_name text,
  weekday    smallint,
  start_time time,
  end_time   time
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;

  return query
  select c.name, ws.weekday, ws.start_time, ws.end_time
  from public.students s
  join public.coaches c on c.id = s.coach_id and c.active
  join public.weekly_slots ws on ws.coach_id = c.id and ws.active
  where s.user_id = auth.uid()
  order by ws.weekday, ws.start_time;
end;
$$;

-- Le assenze annunciate: sapere che giovedì il coach non c'è evita un
-- viaggio a vuoto, ed è l'unica cosa che l'app può dire in anticipo.
create or replace function public.get_my_coach_absences()
returns table (
  coach_name text,
  from_day   date,
  to_day     date,
  reason     text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;

  return query
  select c.name, a.from_day, a.to_day, a.reason
  from public.students s
  join public.coaches c on c.id = s.coach_id and c.active
  join public.coach_absences a on a.coach_id = c.id
  where s.user_id = auth.uid()
    and a.to_day >= public.app_today()
    and a.from_day <= public.app_today() + 60
  order by a.from_day;
end;
$$;

-- La persona si è cambiata la password: l'avviso può sparire.
create or replace function public.note_password_changed()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;
  update public.profiles set password_reset_at = null, updated_at = now()
   where user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- L'elenco persone dice anche a che punto è ciascuno.
-- ---------------------------------------------------------------------
-- Le colonne in uscita cambiano, e Postgres non lo consente a una
-- funzione che esiste già.
drop function if exists public.list_people();

create function public.list_people()
returns table (
  user_id           uuid,
  email             text,
  display_name      text,
  avatar_path       text,
  is_student        boolean,
  coach_id          uuid,
  intake_updated_at timestamptz,
  last_booking      date,
  enrolled          boolean,
  active            boolean,
  is_coach          boolean,
  has_workout       boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  select u.id,
         coalesce(p.email, u.email),
         coalesce(
           nullif(btrim(p.display_name), ''),
           nullif(btrim(p.full_name), ''),
           (select nullif(btrim(b.full_name), '') from public.bookings b
             where b.user_id = u.id and btrim(coalesce(b.full_name, '')) <> ''
             order by b.created_at desc limit 1)
         ),
         p.avatar_path,
         s.user_id is not null, s.coach_id, s.intake_updated_at,
         (select max(b.day) from public.bookings b where b.user_id = u.id),
         coalesce(s.enrolled, false),
         coalesce(s.active, true),
         -- Chi ha le chiavi del pannello non si cancella e non si
         -- reimposta da qui: l'elenco deve poterlo dire al bottone.
         exists (select 1 from public.admins a where a.user_id = u.id),
         exists (select 1 from public.workouts w
                  where w.student_id = u.id and w.status = 'active')
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.students s on s.user_id = u.id
  order by coalesce(
    nullif(btrim(p.display_name), ''),
    nullif(btrim(p.full_name), ''),
    p.email,
    u.email
  );
end;
$$;

revoke all on function public.set_student(uuid, uuid, boolean, boolean) from public;
revoke all on function public.clear_student_coach(uuid)  from public;
revoke all on function public.get_my_membership()        from public;
revoke all on function public.get_my_coach_hours()       from public;
revoke all on function public.get_my_coach_absences()    from public;
revoke all on function public.note_password_changed()    from public;
revoke all on function public.list_people()              from public;

grant execute on function public.set_student(uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.clear_student_coach(uuid)  to authenticated;
grant execute on function public.get_my_membership()        to authenticated;
grant execute on function public.get_my_coach_hours()       to authenticated;
grant execute on function public.get_my_coach_absences()    to authenticated;
grant execute on function public.note_password_changed()    to authenticated;
grant execute on function public.list_people()              to authenticated;
