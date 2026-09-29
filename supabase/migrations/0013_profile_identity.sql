-- =====================================================================
-- Nome e foto della persona, validi sia come allievo sia come coach.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- Separato da full_name di proposito: full_name è il nome di chi fa la
-- prova, che può essere il figlio di chi ha l'account. display_name è
-- di chi possiede l'account.
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_path  text;

-- ---------------------------------------------------------------------
-- Il proprio profilo, con quello che serve a mostrarlo.
-- ---------------------------------------------------------------------
create or replace function public.get_my_profile()
returns table (display_name text, avatar_path text, email text)
language sql stable security definer set search_path = public as $$
  select p.display_name, p.avatar_path, coalesce(p.email, u.email)
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = auth.uid();
$$;

create or replace function public.save_my_profile(
  p_display_name text,
  p_avatar_path  text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name  text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;
  if v_name is not null and length(v_name) > 80 then
    raise exception 'NAME_TOO_LONG' using hint = 'Il nome è troppo lungo.';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.profiles (user_id, email, display_name, avatar_path, updated_at)
  values (auth.uid(), v_email, v_name, nullif(btrim(coalesce(p_avatar_path, '')), ''), now())
  on conflict (user_id) do update
    set display_name = v_name,
        avatar_path  = nullif(btrim(coalesce(p_avatar_path, '')), ''),
        updated_at   = now();
end;
$$;

revoke all on function public.get_my_profile() from public;
revoke all on function public.save_my_profile(text, text) from public;
grant execute on function public.get_my_profile()            to authenticated;
grant execute on function public.save_my_profile(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- L'elenco degli accessi mostra i nomi, non gli indirizzi email.
-- ---------------------------------------------------------------------
drop function if exists public.list_admins();

create or replace function public.list_admins()
returns table (
  admin_id     uuid,
  admin_email  text,
  display_name text,
  avatar_path  text,
  granted_at   timestamptz,
  is_me        boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  select a.user_id, coalesce(a.email, u.email), p.display_name, p.avatar_path,
         a.created_at, a.user_id = auth.uid()
  from public.admins a
  left join auth.users u    on u.id = a.user_id
  left join public.profiles p on p.user_id = a.user_id
  order by coalesce(p.display_name, a.email, u.email);
end;
$$;

revoke all on function public.list_admins() from public;
grant execute on function public.list_admins() to authenticated;

-- ---------------------------------------------------------------------
-- Dove finiscono le foto. Il blocco è protetto perché lo schema
-- storage esiste solo su Supabase, non su un Postgres qualunque.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage assente: salto la creazione del bucket (normale fuori da Supabase).';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

  -- Lettura libera: sono foto del profilo, mostrate nell'app.
  execute 'drop policy if exists avatars_public_read on storage.objects';
  execute $p$create policy avatars_public_read on storage.objects
             for select using (bucket_id = 'avatars')$p$;

  -- Ciascuno scrive solo nella cartella col proprio identificativo:
  -- nessuno può sostituire la foto di un altro.
  execute 'drop policy if exists avatars_own_write on storage.objects';
  execute $p$create policy avatars_own_write on storage.objects
             for insert to authenticated
             with check (bucket_id = 'avatars'
                         and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  execute 'drop policy if exists avatars_own_update on storage.objects';
  execute $p$create policy avatars_own_update on storage.objects
             for update to authenticated
             using (bucket_id = 'avatars'
                    and (storage.foldername(name))[1] = auth.uid()::text)$p$;

  execute 'drop policy if exists avatars_own_delete on storage.objects';
  execute $p$create policy avatars_own_delete on storage.objects
             for delete to authenticated
             using (bucket_id = 'avatars'
                    and (storage.foldername(name))[1] = auth.uid()::text)$p$;
end $$;
