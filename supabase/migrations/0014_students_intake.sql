-- =====================================================================
-- Allievi, questionario iniziale e valutazioni ripetibili.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Libreria esercizi. Serve alle valutazioni: "Trazioni: 6" a marzo e
-- "Trazioni: 9" a giugno si confrontano solo se sono lo stesso
-- esercizio, non due righe scritte a mano in modo diverso.
-- ---------------------------------------------------------------------
create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,
  unit       text not null default 'reps' check (unit in ('reps', 'seconds', 'kg', 'meters')),
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists exercises_name_unique on public.exercises (lower(btrim(name)));

alter table public.exercises enable row level security;

drop policy if exists exercises_admin_all on public.exercises;
create policy exercises_admin_all on public.exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Allievi. Non è una lista da tenere aggiornata a mano: la riga nasce
-- quando compili il questionario o assegni una scheda.
-- ---------------------------------------------------------------------
create table if not exists public.students (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  coach_id          uuid references public.coaches(id) on delete set null,
  active            boolean not null default true,
  -- I dati sanitari richiedono un consenso esplicito e separato:
  -- l'informativa generale non basta.
  health_consent_at timestamptz,
  intake_updated_at timestamptz,
  intake_filled_by  uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table public.students enable row level security;

drop policy if exists students_admin_all on public.students;
create policy students_admin_all on public.students
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists students_own_read on public.students;
create policy students_own_read on public.students
  for select to authenticated using (user_id = auth.uid());

create or replace function public.ensure_student(p_user_id uuid)
returns void
language sql security definer set search_path = public as $$
  insert into public.students (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
$$;

-- ---------------------------------------------------------------------
-- Questionario. Le domande vivono nel codice, non in colonne fisse:
-- riformularne una è una modifica da cinque minuti e le risposte già
-- raccolte restano valide.
-- ---------------------------------------------------------------------
create table if not exists public.intake_answers (
  user_id     uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.intake_answers enable row level security;

drop policy if exists intake_admin_all on public.intake_answers;
create policy intake_admin_all on public.intake_answers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- L'allievo ha diritto di sapere cosa è scritto su di lui.
drop policy if exists intake_own_read on public.intake_answers;
create policy intake_own_read on public.intake_answers
  for select to authenticated using (user_id = auth.uid());

create or replace function public.save_intake(
  p_user_id        uuid,
  p_answers        jsonb,
  p_health_consent boolean default false
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if p_user_id is null then
    raise exception 'NO_STUDENT' using hint = 'Scegli la persona a cui appartiene il questionario.';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'INVALID_ANSWERS' using hint = 'Risposte in formato non valido.';
  end if;

  perform public.ensure_student(p_user_id);

  -- Le chiavi assenti dal nuovo invio vengono tolte: il questionario è
  -- una fotografia intera, non un accumulo di risposte vecchie.
  delete from public.intake_answers a
   where a.user_id = p_user_id and not (p_answers ? a.question_id);

  for k in select jsonb_object_keys(p_answers) loop
    insert into public.intake_answers (user_id, question_id, value, updated_at)
    values (p_user_id, k, p_answers -> k, now())
    on conflict (user_id, question_id) do update
      set value = excluded.value, updated_at = now();
  end loop;

  update public.students
     set intake_updated_at = now(),
         intake_filled_by  = auth.uid(),
         -- Un consenso dato non si ritira per distrazione: resta finché
         -- non lo si revoca esplicitamente.
         health_consent_at = case
           when p_health_consent then coalesce(health_consent_at, now())
           else health_consent_at
         end
   where user_id = p_user_id;
end;
$$;

create or replace function public.get_intake(p_user_id uuid)
returns table (question_id text, value jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() and p_user_id is distinct from auth.uid() then
    raise exception 'NOT_ALLOWED' using hint = 'Puoi vedere solo il tuo questionario.';
  end if;

  return query
  select a.question_id, a.value, a.updated_at
  from public.intake_answers a
  where a.user_id = p_user_id;
end;
$$;

revoke all on function public.save_intake(uuid, jsonb, boolean) from public;
revoke all on function public.get_intake(uuid) from public;
revoke all on function public.ensure_student(uuid) from public;
grant execute on function public.save_intake(uuid, jsonb, boolean) to authenticated;
grant execute on function public.get_intake(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Valutazioni: una misurazione datata, ripetibile. La prima è il punto
-- di partenza, le successive sono i progressi — senza costruire altro.
-- ---------------------------------------------------------------------
create table if not exists public.assessments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null default public.app_today(),
  notes      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assessments_user_idx on public.assessments (user_id, day desc);

create table if not exists public.assessment_items (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete restrict,
  value         numeric not null check (value >= 0),
  unit          text not null,
  position      int not null default 0
);

alter table public.assessments      enable row level security;
alter table public.assessment_items enable row level security;

drop policy if exists assessments_admin_all on public.assessments;
create policy assessments_admin_all on public.assessments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists assessments_own_read on public.assessments;
create policy assessments_own_read on public.assessments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists assessment_items_admin_all on public.assessment_items;
create policy assessment_items_admin_all on public.assessment_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists assessment_items_own_read on public.assessment_items;
create policy assessment_items_own_read on public.assessment_items
  for select to authenticated using (
    exists (select 1 from public.assessments a
            where a.id = assessment_id and a.user_id = auth.uid())
  );

create or replace function public.save_assessment(
  p_user_id uuid,
  p_day     date,
  p_items   jsonb,
  p_notes   text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_item jsonb;
  v_pos  int := 0;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'NO_ITEMS' using hint = 'Aggiungi almeno un esercizio alla valutazione.';
  end if;

  perform public.ensure_student(p_user_id);

  insert into public.assessments (user_id, day, notes, created_by)
  values (p_user_id, coalesce(p_day, public.app_today()),
          nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.assessment_items (assessment_id, exercise_id, value, unit, position)
    values (
      v_id,
      (v_item ->> 'exercise_id')::uuid,
      (v_item ->> 'value')::numeric,
      coalesce(v_item ->> 'unit', 'reps'),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  return v_id;
end;
$$;

-- Storico di una persona, esercizio per esercizio: serve a vedere se
-- sta migliorando, che è il motivo per cui si misura.
create or replace function public.get_assessments(p_user_id uuid)
returns table (
  assessment_id uuid,
  day           date,
  notes         text,
  exercise_id   uuid,
  exercise_name text,
  value         numeric,
  unit          text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() and p_user_id is distinct from auth.uid() then
    raise exception 'NOT_ALLOWED' using hint = 'Puoi vedere solo le tue valutazioni.';
  end if;

  return query
  select a.id, a.day, a.notes, e.id, e.name, i.value, i.unit
  from public.assessments a
  join public.assessment_items i on i.assessment_id = a.id
  join public.exercises e on e.id = i.exercise_id
  where a.user_id = p_user_id
  order by a.day desc, i.position;
end;
$$;

revoke all on function public.save_assessment(uuid, date, jsonb, text) from public;
revoke all on function public.get_assessments(uuid) from public;
grant execute on function public.save_assessment(uuid, date, jsonb, text) to authenticated;
grant execute on function public.get_assessments(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Le persone fra cui scegliere: chiunque abbia un account, con quello
-- che serve a riconoscerlo e a sapere a che punto è.
-- ---------------------------------------------------------------------
create or replace function public.list_people()
returns table (
  user_id           uuid,
  email             text,
  display_name      text,
  avatar_path       text,
  is_student        boolean,
  coach_id          uuid,
  intake_updated_at timestamptz,
  last_booking      date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  select u.id, coalesce(p.email, u.email), p.display_name, p.avatar_path,
         s.user_id is not null, s.coach_id, s.intake_updated_at,
         (select max(b.day) from public.bookings b where b.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.students s on s.user_id = u.id
  order by coalesce(p.display_name, p.email, u.email);
end;
$$;

revoke all on function public.list_people() from public;
grant execute on function public.list_people() to authenticated;
