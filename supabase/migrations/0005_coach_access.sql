-- =====================================================================
-- Gestione degli accessi dei coach dal pannello, senza passare da SQL.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- Un coach deve poter vedere chi altro ha accesso.
drop policy if exists admins_self_read on public.admins;
create policy admins_read on public.admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Elenco degli accessi. L'email viene da auth.users, che non e'
-- leggibile direttamente: la funzione fa da finestra controllata.
-- ---------------------------------------------------------------------
create or replace function public.list_admins()
returns table (admin_id uuid, admin_email text, granted_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  select a.user_id, coalesce(a.email, u.email), a.created_at, a.user_id = auth.uid()
  from public.admins a
  left join auth.users u on u.id = a.user_id
  order by a.created_at;
end;
$$;

-- ---------------------------------------------------------------------
-- Concessione dell'accesso a un indirizzo email.
-- L'account non viene creato qui: la persona deve prima entrare almeno
-- una volta dal sito col link via email. Cosi' l'indirizzo risulta
-- verificato e nessuno puo' dare accesso a una casella inesistente o
-- sbagliata di una lettera.
-- ---------------------------------------------------------------------
create or replace function public.grant_admin(p_email text)
returns table (admin_id uuid, admin_email text)
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user  uuid;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'INVALID_EMAIL' using hint = 'Inserisci un indirizzo email valido.';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email;

  if v_user is null then
    raise exception 'USER_NOT_FOUND'
      using hint = 'Nessun account con questa email. Chiedi alla persona di accedere una volta dal sito, poi riprova.';
  end if;

  insert into public.admins as a (user_id, email)
  values (v_user, v_email)
  on conflict (user_id) do update set email = excluded.email;

  return query select v_user, v_email;
end;
$$;

-- ---------------------------------------------------------------------
-- Revoca. Non si puo' revocare a se stessi: evita di restare chiusi
-- fuori dal pannello con un click distratto.
-- ---------------------------------------------------------------------
create or replace function public.revoke_admin(p_user_id uuid)
returns table (removed uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_REMOVE_SELF'
      using hint = 'Non puoi togliere l''accesso a te stesso. Chiedilo a un altro coach.';
  end if;
  if not exists (select 1 from public.admins a where a.user_id = p_user_id) then
    raise exception 'NOT_FOUND' using hint = 'Questo accesso non esiste.';
  end if;

  delete from public.admins a where a.user_id = p_user_id;
  return query select p_user_id;
end;
$$;

revoke all on function public.list_admins() from public;
revoke all on function public.grant_admin(text) from public;
revoke all on function public.revoke_admin(uuid) from public;
grant execute on function public.list_admins()      to authenticated;
grant execute on function public.grant_admin(text)  to authenticated;
grant execute on function public.revoke_admin(uuid) to authenticated;
