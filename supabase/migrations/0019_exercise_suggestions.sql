-- =====================================================================
-- Esercizi proposti a partire dalle schede già scritte.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================
--
-- Il corpo di una scheda è testo libero, ed è giusto che lo resti. Ma
-- dentro ci sono già i nomi degli esercizi che il coach usa davvero:
-- invece di fargliene riscrivere una lista da zero, li tiriamo fuori
-- da lì.
--
-- La macchina propone, il coach accetta. Nessun esercizio entra in
-- libreria da solo: leggere testo libero è indovinare, e una libreria
-- che si riempie di «Riscaldamento 10'» va ripulita a mano, che è
-- peggio del problema di partenza.

-- Quello che il coach ha guardato e scartato non deve ripresentarsi
-- ogni volta che apre la pagina.
create table if not exists public.dismissed_exercise_names (
  name         text primary key,
  dismissed_by uuid references auth.users(id) on delete set null,
  at           timestamptz not null default now()
);

alter table public.dismissed_exercise_names enable row level security;

drop policy if exists dismissed_names_admin_all on public.dismissed_exercise_names;
create policy dismissed_names_admin_all on public.dismissed_exercise_names
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Da una riga di scheda al nome di un esercizio.
--
-- «Trazioni 4x5 (pausa 2')» → «Trazioni»
-- «- Piegamenti 4x8»        → «Piegamenti»
-- «Plank 3x40"»             → «Plank»
--
-- Non è esatta e non può esserlo: serve solo a produrre un elenco di
-- proposte da guardare. Quello che sbaglia lo scarta il coach.
-- ---------------------------------------------------------------------
create or replace function public.exercise_name_from_line(p_line text)
returns text
language sql immutable set search_path = public as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              -- Quello che sta fra parentesi è un'indicazione, non un nome.
              regexp_replace(coalesce(p_line, ''), '\(.*?\)', ' ', 'g'),
              -- Elenchi puntati e numerazioni all'inizio. Un numero si
              -- toglie solo se è seguito da punto o parentesi: in
              -- «100 metri sprint» fa parte del nome.
              '^[\s\-\*•·–—]*([0-9]+[\.\)]\s*)?\s*', ''
            ),
            -- Serie e ripetizioni: da qui in poi non c'è più il nome.
            '\m[0-9]+\s*[xX×]\s*[0-9].*$', ''
          ),
          -- Durate e carichi rimasti in coda: 40", 10'', 2'', 70%, 12 kg.
          '[\s,:;–—-]*[0-9]+\s*(''|"|''''|%|kg|sec|secondi|min|minuti|rip|ripetizioni)?\s*$', '',
          'gi'
        ),
        -- Doppi spazi lasciati dalle sostituzioni.
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

-- ---------------------------------------------------------------------
-- I candidati: nomi che compaiono nelle schede, non ancora in libreria
-- e non ancora scartati, i più usati per primi.
-- ---------------------------------------------------------------------
create or replace function public.suggest_exercises()
returns table (name text, uses int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;

  return query
  with righe as (
    select public.exercise_name_from_line(riga) as nome
    from public.workout_days d,
         lateral unnest(string_to_array(coalesce(d.body, ''), E'\n')) as riga
  ),
  pulite as (
    select btrim(nome) as nome from righe
    where nome is not null
      -- Una parola di due lettere non è un esercizio, e una riga di
      -- quaranta caratteri è una frase.
      and length(btrim(nome)) between 3 and 40
      -- Deve contenere lettere vere, non solo numeri e segni.
      and btrim(nome) ~ '[A-Za-zÀ-ÿ]{3}'
  )
  select p.nome, count(*)::int
  from pulite p
  where not exists (
    select 1 from public.exercises e
    where lower(btrim(e.name)) = lower(btrim(p.nome))
  )
    and not exists (
    select 1 from public.dismissed_exercise_names d
    where d.name = lower(btrim(p.nome))
  )
  group by p.nome
  order by count(*) desc, p.nome;
end;
$$;

-- Scartare una proposta: si registra in minuscolo, come il confronto.
create or replace function public.dismiss_exercise_name(p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using hint = 'Operazione riservata ai coach.';
  end if;
  insert into public.dismissed_exercise_names (name, dismissed_by)
  values (lower(btrim(coalesce(p_name, ''))), auth.uid())
  on conflict (name) do nothing;
end;
$$;

revoke all on function public.suggest_exercises()            from public;
revoke all on function public.dismiss_exercise_name(text)    from public;
grant execute on function public.suggest_exercises()         to authenticated;
grant execute on function public.dismiss_exercise_name(text) to authenticated;
