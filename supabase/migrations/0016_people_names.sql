-- =====================================================================
-- Nome e cognome subito visibili nell'elenco persone.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- Il nome c'era già e non lo stavamo guardando: chi prenota una prova
-- scrive nome e cognome nel modulo, e finisce in profiles.full_name.
-- L'elenco leggeva solo display_name, che si riempie soltanto da
-- /profilo, e così al coach restava un indirizzo email.
--
-- Ora si prende il primo nome disponibile, in ordine di affidabilità:
-- quello scelto dalla persona, quello dato prenotando, quello scritto
-- sull'ultima prova. L'email torna a parte, che serve comunque a
-- distinguere due omonimi.
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
         (select max(b.day) from public.bookings b where b.user_id = u.id)
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

revoke all on function public.list_people() from public;
grant execute on function public.list_people() to authenticated;

-- Chi si registra senza prenotare non passa da nessun modulo che chieda
-- il nome. Glielo chiediamo al momento della registrazione e lo
-- salviamo subito, così nell'elenco non compare mai un anonimo.
create or replace function public.set_my_name(p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;
  if v_name is null then
    return;  -- Un nome vuoto non è un errore: semplicemente non si scrive.
  end if;
  if length(v_name) > 80 then
    raise exception 'NAME_TOO_LONG' using hint = 'Il nome è troppo lungo.';
  end if;

  insert into public.profiles (user_id, email, display_name, updated_at)
  values (auth.uid(),
          (select u.email from auth.users u where u.id = auth.uid()),
          v_name, now())
  on conflict (user_id) do update
    -- Non sovrascrive un nome già scelto: questo serve al primo accesso.
    set display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), excluded.display_name),
        updated_at = now();
end;
$$;

revoke all on function public.set_my_name(text) from public;
grant execute on function public.set_my_name(text) to authenticated;
