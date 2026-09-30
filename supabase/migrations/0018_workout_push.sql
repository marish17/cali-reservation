-- =====================================================================
-- Avviso all'allievo quando la scheda è pronta o cambia.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================
--
-- Fino a qui le notifiche nascevano tutte da una prenotazione. Ma un
-- allievo iscritto prenotazioni non ne fa: non poteva ricevere niente,
-- mai. E proprio a lui serve sapere che la scheda è arrivata, invece di
-- aprire l'app ogni giorno per controllare.

-- ---------------------------------------------------------------------
-- Il destinatario non è più per forza legato a una prenotazione: il
-- parametro cambia nome perché adesso può essere anche una scheda.
-- ---------------------------------------------------------------------
drop function if exists public.push_notify(uuid, text);

create function public.push_notify(p_subject_id uuid, p_audience text)
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
                 'subject_id', p_subject_id,
                 -- Il nome vecchio resta finché la funzione `push` non
                 -- viene ripubblicata: chi è ancora alla versione
                 -- precedente legge questo e continua a funzionare.
                 'booking_id', p_subject_id,
                 'audience',   p_audience
               ),
    timeout_milliseconds := 5000
  );
exception when others then
  -- Un guasto nell'invio non può impedire di prenotare o di salvare
  -- una scheda.
  raise warning 'push_notify fallita: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------
-- Destinatari e testo, per tutti i tipi di avviso. La usa la funzione
-- di invio, che si autentica con la chiave di servizio.
-- ---------------------------------------------------------------------
create or replace function public.push_targets(
  p_subject_id uuid,
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
  b      public.bookings%rowtype;
  w      public.workouts%rowtype;
  v_when text;
  v_by   text;
begin
  if p_audience in ('coaches', 'booker') then
    select * into b from public.bookings where id = p_subject_id;
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
    else
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

  elsif p_audience in ('student_new', 'student_update') then
    select * into w from public.workouts where id = p_subject_id;
    if not found or w.student_id is null or w.status <> 'active' then
      return;
    end if;

    select c.name into v_by from public.coaches c where c.id = w.coach_id;

    return query
    select s.endpoint, s.p256dh, s.auth,
           (case p_audience
              when 'student_new' then 'La tua scheda è pronta'
              else 'Scheda aggiornata'
            end)::text,
           (w.name || coalesce(' — ' || v_by, ''))::text,
           '/'::text
    from public.push_subscriptions s
    where s.user_id = w.student_id;
  end if;
end;
$$;

-- La vecchia resta, e delega: la funzione `push` già pubblicata chiama
-- ancora questo nome, e deve continuare a funzionare finché non la
-- ripubblichi.
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
language sql security definer set search_path = public as $$
  select * from public.push_targets(p_booking_id, p_audience);
$$;

revoke all on function public.push_targets(uuid, text) from public;
revoke all on function public.push_targets_for_booking(uuid, text) from public;
-- Nessun grant a anon/authenticated: solo la chiave di servizio le usa.

-- ---------------------------------------------------------------------
-- L'avviso parte da chi salva, non da un innesco sulla tabella: ogni
-- scrittura passa da qui, e così si evita di avvisare per la scheda
-- che viene archiviata quando se ne assegna una nuova.
--
-- p_notify permette di correggere un refuso senza suonare il telefono
-- di nessuno: il coach decide, invece di indovinare noi.
-- ---------------------------------------------------------------------
drop function if exists public.save_workout(uuid, uuid, text, jsonb, text, uuid);

create function public.save_workout(
  p_workout_id uuid,
  p_student_id uuid,
  p_name       text,
  p_days       jsonb,
  p_intro      text    default null,
  p_coach_id   uuid    default null,
  p_notify     boolean default true
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := p_workout_id;
  v_name   text := nullif(btrim(coalesce(p_name, '')), '');
  v_status text;
  v_day    jsonb;
  v_pos    int := 0;
  v_new    boolean := p_workout_id is null;
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

  -- I modelli non sono di nessuno: non c'è nessuno da avvisare.
  if p_notify and p_student_id is not null then
    perform public.push_notify(
      v_id,
      case when v_new then 'student_new' else 'student_update' end
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.set_workout_status(p_workout_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
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
   where id = p_workout_id and student_id is not null
   returning student_id into v_student;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Scheda non trovata.';
  end if;

  -- Riprendere una vecchia scheda vuol dire che da oggi si segue
  -- quella: l'allievo deve saperlo. Archiviarla e basta no, perché
  -- subito dopo ne arriva un'altra con il suo avviso.
  if p_status = 'active' then
    perform public.push_notify(p_workout_id, 'student_update');
  end if;
end;
$$;

revoke all on function public.save_workout(uuid, uuid, text, jsonb, text, uuid, boolean) from public;
grant execute on function public.save_workout(uuid, uuid, text, jsonb, text, uuid, boolean) to authenticated;
