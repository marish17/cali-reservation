-- =====================================================================
-- Schede di allenamento: il coach scrive, l'allievo legge e annota.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Una scheda è testo libero diviso in giorni, non una griglia di
-- esercizi, serie e ripetizioni. Il coach la scrive o la incolla come
-- farebbe in una nota sul telefono: se compilarla costa più di due
-- minuti non la compila nessuno.
--
-- student_id nullo = modello da riusare, non ancora di nessuno.
-- ---------------------------------------------------------------------
create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade,
  coach_id   uuid references public.coaches(id) on delete set null,
  name       text not null,
  status     text not null default 'active' check (status in ('active', 'archived', 'template')),
  intro      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un modello non appartiene a nessuno, una scheda assegnata sì.
  constraint workouts_template_has_no_student
    check ((status = 'template') = (student_id is null))
);

-- Una persona ha una scheda attiva sola: due schede attive insieme
-- vogliono dire che nessuno sa quale seguire.
create unique index if not exists workouts_one_active_per_student
  on public.workouts (student_id) where status = 'active';

create index if not exists workouts_student_idx on public.workouts (student_id, status);

create table if not exists public.workout_days (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  position   int not null,
  title      text not null,
  body       text not null default '',
  unique (workout_id, position)
);

-- L'allievo annota sul proprio giorno: come è andata, quanto pesava,
-- cosa gli ha fatto male. È suo, il coach lo legge.
create table if not exists public.workout_notes (
  day_id     uuid not null references public.workout_days(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (day_id, user_id)
);

alter table public.workouts      enable row level security;
alter table public.workout_days  enable row level security;
alter table public.workout_notes enable row level security;

drop policy if exists workouts_admin_all on public.workouts;
create policy workouts_admin_all on public.workouts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists workouts_own_read on public.workouts;
create policy workouts_own_read on public.workouts
  for select to authenticated using (student_id = auth.uid());

drop policy if exists workout_days_admin_all on public.workout_days;
create policy workout_days_admin_all on public.workout_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists workout_days_own_read on public.workout_days;
create policy workout_days_own_read on public.workout_days
  for select to authenticated using (
    exists (select 1 from public.workouts w
            where w.id = workout_id and w.student_id = auth.uid())
  );

-- Le note le scrive chi si allena, e le legge chi lo allena.
drop policy if exists workout_notes_own_all on public.workout_notes;
create policy workout_notes_own_all on public.workout_notes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists workout_notes_admin_read on public.workout_notes;
create policy workout_notes_admin_read on public.workout_notes
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Salvataggio in un colpo solo: scheda e giorni insieme. Salvare i
-- giorni uno per uno lascerebbe una scheda a metà se il telefono perde
-- la linea in mezzo.
-- ---------------------------------------------------------------------
create or replace function public.save_workout(
  p_workout_id uuid,
  p_student_id uuid,
  p_name       text,
  p_days       jsonb,
  p_intro      text default null,
  p_coach_id   uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := p_workout_id;
  v_name   text := nullif(btrim(coalesce(p_name, '')), '');
  v_status text;
  v_day    jsonb;
  v_pos    int := 0;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if v_name is null then
    raise exception 'NO_NAME' using hint = 'Dai un nome alla scheda.';
  end if;
  if jsonb_typeof(p_days) is distinct from 'array' then
    raise exception 'INVALID_DAYS' using hint = 'Giorni in formato non valido.';
  end if;
  -- Due o tre giorni ciclici: è la forma che si è deciso di usare, e un
  -- vincolo qui vale più di un controllo nel browser.
  if jsonb_array_length(p_days) not between 2 and 3 then
    raise exception 'WRONG_DAY_COUNT' using hint = 'Una scheda ha due o tre giorni.';
  end if;

  v_status := case when p_student_id is null then 'template' else 'active' end;

  if p_student_id is not null then
    perform public.ensure_student(p_student_id);
    -- Assegnarne una nuova archivia la precedente: è il gesto che
    -- il coach ha in mente, e senza questo l'indice unico lo bloccherebbe.
    update public.workouts
       set status = 'archived', updated_at = now()
     where student_id = p_student_id
       and status = 'active'
       and (v_id is null or id <> v_id);
  end if;

  if v_id is null then
    insert into public.workouts (student_id, coach_id, name, status, intro, created_by)
    values (p_student_id, p_coach_id, v_name, v_status,
            nullif(btrim(coalesce(p_intro, '')), ''), auth.uid())
    returning id into v_id;
  else
    update public.workouts
       set student_id = p_student_id,
           coach_id   = p_coach_id,
           name       = v_name,
           -- Una scheda archiviata resta archiviata quando la si corregge,
           -- ma se la si stacca dall'allievo diventa un modello: il
           -- vincolo non ammette una archiviata senza proprietario.
           status     = case
             when p_student_id is null then 'template'
             when status = 'archived'  then 'archived'
             else v_status
           end,
           intro      = nullif(btrim(coalesce(p_intro, '')), ''),
           updated_at = now()
     where id = v_id;
    if not found then
      raise exception 'NOT_FOUND' using hint = 'Scheda non trovata.';
    end if;
  end if;

  -- I giorni si riscrivono interi. Le note dell'allievo sono agganciate
  -- all'id del giorno, quindi i giorni che restano vanno aggiornati,
  -- non cancellati e rifatti: cancellarli butterebbe via le note.
  for v_day in select * from jsonb_array_elements(p_days) loop
    insert into public.workout_days (workout_id, position, title, body)
    values (v_id, v_pos,
            coalesce(nullif(btrim(v_day ->> 'title'), ''), 'Giorno ' || (v_pos + 1)),
            coalesce(v_day ->> 'body', ''))
    on conflict (workout_id, position) do update
      set title = excluded.title, body = excluded.body;
    v_pos := v_pos + 1;
  end loop;

  delete from public.workout_days where workout_id = v_id and position >= v_pos;

  return v_id;
end;
$$;

create or replace function public.set_workout_status(p_workout_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if p_status not in ('active', 'archived') then
    raise exception 'INVALID_STATUS' using hint = 'Stato non valido.';
  end if;

  if p_status = 'active' then
    update public.workouts w
       set status = 'archived', updated_at = now()
      from public.workouts target
     where target.id = p_workout_id
       and w.student_id = target.student_id
       and w.status = 'active'
       and w.id <> p_workout_id;
  end if;

  update public.workouts set status = p_status, updated_at = now()
   where id = p_workout_id and student_id is not null;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Scheda non trovata.';
  end if;
end;
$$;

-- Duplicare è il modo in cui una scheda ne genera un'altra: si parte da
-- quella di un allievo simile e si cambia quel che serve.
create or replace function public.duplicate_workout(p_workout_id uuid, p_student_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_new uuid;
  v_src public.workouts%rowtype;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  select * into v_src from public.workouts where id = p_workout_id;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Scheda non trovata.';
  end if;

  return public.save_workout(
    null, p_student_id,
    case when p_student_id is null then v_src.name || ' (copia)' else v_src.name end,
    (select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'body', d.body)
                               order by d.position), '[]'::jsonb)
       from public.workout_days d where d.workout_id = p_workout_id),
    v_src.intro, v_src.coach_id
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Lettura. La stessa funzione serve al coach e all'allievo: cambia solo
-- chi può chiederla per chi.
-- ---------------------------------------------------------------------
create or replace function public.get_workout(p_workout_id uuid)
returns table (
  workout_id uuid,
  name       text,
  intro      text,
  status     text,
  student_id uuid,
  coach_id   uuid,
  updated_at timestamptz,
  day_id     uuid,
  day_position int,
  title      text,
  body       text,
  note       text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid;
begin
  select w.student_id into v_student from public.workouts w where w.id = p_workout_id;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Scheda non trovata.';
  end if;
  if not public.is_admin() and v_student is distinct from auth.uid() then
    raise exception 'NOT_ALLOWED' using hint = 'Puoi vedere solo la tua scheda.';
  end if;

  return query
  select w.id, w.name, w.intro, w.status, w.student_id, w.coach_id, w.updated_at,
         d.id, d.position, d.title, d.body,
         (select n.body from public.workout_notes n
           where n.day_id = d.id and n.user_id = coalesce(v_student, auth.uid()))
  from public.workouts w
  left join public.workout_days d on d.workout_id = w.id
  where w.id = p_workout_id
  order by d.position;
end;
$$;

-- La scheda che l'allievo deve seguire adesso, senza doverla cercare.
create or replace function public.get_my_workout()
returns table (
  workout_id uuid,
  name       text,
  intro      text,
  updated_at timestamptz,
  day_id     uuid,
  day_position int,
  title      text,
  body       text,
  note       text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per vedere la tua scheda.';
  end if;

  select w.id into v_id from public.workouts w
   where w.student_id = auth.uid() and w.status = 'active'
   limit 1;
  if v_id is null then return; end if;

  return query
  select g.workout_id, g.name, g.intro, g.updated_at,
         g.day_id, g.day_position, g.title, g.body, g.note
  from public.get_workout(v_id) g;
end;
$$;

create or replace function public.save_workout_note(p_day_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per annotare.';
  end if;
  -- Si annota sulla propria scheda, non su quella di un altro.
  if not exists (
    select 1 from public.workout_days d
    join public.workouts w on w.id = d.workout_id
    where d.id = p_day_id and w.student_id = auth.uid()
  ) then
    raise exception 'NOT_ALLOWED' using hint = 'Questo giorno non è della tua scheda.';
  end if;
  if length(coalesce(p_body, '')) > 4000 then
    raise exception 'NOTE_TOO_LONG' using hint = 'La nota è troppo lunga.';
  end if;

  insert into public.workout_notes (day_id, user_id, body, updated_at)
  values (p_day_id, auth.uid(), coalesce(p_body, ''), now())
  on conflict (day_id, user_id) do update
    set body = excluded.body, updated_at = now();
end;
$$;

-- Elenco per il coach: le schede di una persona, o i modelli riusabili.
create or replace function public.list_workouts(p_student_id uuid default null)
returns table (
  id         uuid,
  name       text,
  status     text,
  days       int,
  coach_id   uuid,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  select w.id, w.name, w.status,
         (select count(*)::int from public.workout_days d where d.workout_id = w.id),
         w.coach_id, w.updated_at
  from public.workouts w
  where (p_student_id is null and w.student_id is null)
     or (p_student_id is not null and w.student_id = p_student_id)
  order by (w.status = 'active') desc, w.updated_at desc;
end;
$$;

revoke all on function public.save_workout(uuid, uuid, text, jsonb, text, uuid) from public;
revoke all on function public.set_workout_status(uuid, text) from public;
revoke all on function public.duplicate_workout(uuid, uuid) from public;
revoke all on function public.get_workout(uuid) from public;
revoke all on function public.get_my_workout() from public;
revoke all on function public.save_workout_note(uuid, text) from public;
revoke all on function public.list_workouts(uuid) from public;

grant execute on function public.save_workout(uuid, uuid, text, jsonb, text, uuid) to authenticated;
grant execute on function public.set_workout_status(uuid, text)   to authenticated;
grant execute on function public.duplicate_workout(uuid, uuid)    to authenticated;
grant execute on function public.get_workout(uuid)                to authenticated;
grant execute on function public.get_my_workout()                 to authenticated;
grant execute on function public.save_workout_note(uuid, text)    to authenticated;
grant execute on function public.list_workouts(uuid)              to authenticated;
