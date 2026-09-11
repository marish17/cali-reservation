-- =====================================================================
-- Notifiche dentro l'app, senza email.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

-- Quando l'utente ha visto per l'ultima volta l'esito delle sue
-- richieste. Sta sul profilo e non nel browser, cosi' il pallino non
-- riappare passando dal telefono al computer.
alter table public.profiles
  add column if not exists notifications_seen_at timestamptz;

-- L'utente deve poter creare la propria riga di profilo anche prima di
-- aver mai prenotato: senza, non c'e' posto dove segnare la lettura.
drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Segna come lette le novita' fino a questo momento.
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_seen()
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per continuare.';
  end if;

  insert into public.profiles (user_id, notifications_seen_at, updated_at)
  values (auth.uid(), v_now, v_now)
  on conflict (user_id) do update
    set notifications_seen_at = v_now, updated_at = v_now;

  return v_now;
end;
$$;

revoke all on function public.mark_notifications_seen() from public;
grant execute on function public.mark_notifications_seen() to authenticated;

-- ---------------------------------------------------------------------
-- Quante novita' non lette ha l'utente: esiti arrivati dopo l'ultima
-- visita alla pagina delle proprie richieste.
-- ---------------------------------------------------------------------
create or replace function public.my_updates_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.bookings b
  left join public.profiles p on p.user_id = auth.uid()
  where b.user_id = auth.uid()
    and b.decided_at is not null
    and b.decided_at > coalesce(p.notifications_seen_at, '-infinity'::timestamptz);
$$;

revoke all on function public.my_updates_count() from public;
grant execute on function public.my_updates_count() to authenticated;

-- ---------------------------------------------------------------------
-- Quante richieste aspettano una risposta del coach. Serve al badge
-- del pannello: il coach potrebbe leggerlo anche da una query diretta,
-- ma cosi' la regola di "cosa conta come da evadere" sta in un posto solo.
-- ---------------------------------------------------------------------
create or replace function public.pending_count()
returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return (
    select count(*)::int from public.bookings b
    where b.status = 'pending' and b.day >= public.app_today()
  );
end;
$$;

revoke all on function public.pending_count() from public;
grant execute on function public.pending_count() to authenticated;
