-- =====================================================================
-- Telefono obbligatorio alla registrazione, e visibile nell'elenco.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================
--
-- L'email c'era già, perché è il modo in cui si entra. Il telefono
-- invece si chiedeva solo nel modulo della prova: chi si registrava e
-- basta restava senza, e per avvisarlo di qualcosa non c'era modo.

-- ---------------------------------------------------------------------
-- La stessa regola che vale sul modulo della prova, in un posto solo:
-- almeno otto cifre, ignorando spazi, punti e prefissi scritti a mano.
-- ---------------------------------------------------------------------
create or replace function public.valid_phone(p_phone text)
returns boolean
language sql immutable as $$
  select length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 8;
$$;

-- Il telefono si cambia dal proprio profilo: senza questa, chi si è
-- registrato prima di oggi non avrebbe modo di aggiungerlo.
create or replace function public.save_my_phone(p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;
  if v_phone is null or not public.valid_phone(v_phone) then
    raise exception 'INVALID_PHONE' using hint = 'Inserisci un numero di telefono valido.';
  end if;

  insert into public.profiles (user_id, email, phone, updated_at)
  values (auth.uid(),
          (select u.email from auth.users u where u.id = auth.uid()),
          v_phone, now())
  on conflict (user_id) do update
    set phone = excluded.phone, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- La registrazione manda nome e telefono insieme: sono le due cose che
-- servono a riconoscere una persona e a chiamarla.
-- ---------------------------------------------------------------------
drop function if exists public.set_my_name(text);

create function public.set_my_name(p_name text, p_phone text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;
  if v_name is not null and length(v_name) > 80 then
    raise exception 'NAME_TOO_LONG' using hint = 'Il nome è troppo lungo.';
  end if;
  -- Un numero sbagliato è peggio di nessun numero: dà l'illusione di
  -- poter chiamare qualcuno che non risponderà mai.
  if v_phone is not null and not public.valid_phone(v_phone) then
    raise exception 'INVALID_PHONE' using hint = 'Inserisci un numero di telefono valido.';
  end if;
  if v_name is null and v_phone is null then
    return;  -- Niente da scrivere non è un errore.
  end if;

  insert into public.profiles (user_id, email, display_name, phone, updated_at)
  values (auth.uid(),
          (select u.email from auth.users u where u.id = auth.uid()),
          v_name, v_phone, now())
  on conflict (user_id) do update
    -- Non sovrascrive quello che c'è già: questo serve al primo accesso.
    set display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), excluded.display_name),
        phone        = coalesce(nullif(btrim(public.profiles.phone), ''), excluded.phone),
        updated_at   = now();
end;
$$;

-- ---------------------------------------------------------------------
-- L'elenco persone porta anche i recapiti: per chiamare qualcuno non
-- si deve aprire la sua scheda e cercarli.
-- ---------------------------------------------------------------------
drop function if exists public.list_people();

create function public.list_people()
returns table (
  user_id           uuid,
  email             text,
  phone             text,
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
         -- Chi ha prenotato prima di oggi il numero l'ha già dato nel
         -- modulo della prova: si recupera da lì invece di richiederlo.
         coalesce(
           nullif(btrim(p.phone), ''),
           (select nullif(btrim(b.phone), '') from public.bookings b
             where b.user_id = u.id and btrim(coalesce(b.phone, '')) <> ''
             order by b.created_at desc limit 1)
         ),
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

-- Il proprio recapito si rilegge dal profilo, per poterlo correggere.
-- Le colonne in uscita cambiano, e Postgres non lo consente a una
-- funzione che esiste già.
drop function if exists public.get_my_profile();

create function public.get_my_profile()
returns table (
  display_name text,
  avatar_path  text,
  email        text,
  phone        text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;

  return query
  select p.display_name, p.avatar_path,
         coalesce(p.email, (select u.email from auth.users u where u.id = auth.uid())),
         p.phone
  from (select auth.uid() as uid) me
  left join public.profiles p on p.user_id = me.uid;
end;
$$;

revoke all on function public.save_my_phone(text)         from public;
revoke all on function public.set_my_name(text, text)     from public;
revoke all on function public.list_people()               from public;
revoke all on function public.get_my_profile()            from public;

grant execute on function public.save_my_phone(text)      to authenticated;
grant execute on function public.set_my_name(text, text)  to authenticated;
grant execute on function public.list_people()            to authenticated;
grant execute on function public.get_my_profile()         to authenticated;
