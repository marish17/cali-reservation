-- Dice quali migrazioni risultano applicate al database.
-- Da incollare nel SQL Editor di Supabase: risponde con un elenco
-- leggibile, non tocca nulla.

with esiti as (
  select '0001 — tabelle di base' as migrazione,
         to_regclass('public.bookings') is not null as applicata
  union all
  select '0002 — età e accompagnatore',
         exists (select 1 from information_schema.columns
                 where table_name = 'bookings' and column_name = 'birth_date')
  union all
  select '0003 — account e approvazione',
         exists (select 1 from information_schema.columns
                 where table_name = 'bookings' and column_name = 'user_id')
  union all
  select '0004 — nome della palestra',
         exists (select 1 from public.settings where id and gym_name = 'Calisthenics Academy')
  union all
  select '0005 — gestione accessi',
         to_regprocedure('public.grant_admin(text)') is not null
  union all
  select '0006 — privacy e consenso',
         to_regprocedure('public.request_trial(uuid,date,text,date,text,boolean,text,text,text)') is not null
  union all
  select '0007 — annullamento dal coach',
         exists (select 1 from information_schema.parameters
                 where specific_schema = 'public' and parameter_name = 'phone'
                   and specific_name like 'decide_booking%')
  union all
  select '0008 — notifiche nell''app',
         to_regprocedure('public.my_updates_count()') is not null
  union all
  select '0009 — notifiche push',
         to_regclass('public.push_subscriptions') is not null
  union all
  select '0010 — inneschi delle push',
         to_regclass('public.private_config') is not null
     and to_regprocedure('public.push_notify(uuid,text)') is not null
  union all
  -- Senza questa il bottone "Avvisami" resta disabilitato.
  select '0011 — chiave push al browser',
         exists (select 1 from information_schema.parameters
                 where specific_schema = 'public' and parameter_name = 'vapid_public_key'
                   and specific_name like 'get_public_settings%')
  union all
  -- Senza questa non puoi segnare le assenze dei coach.
  select '0012 — account coach e assenze',
         to_regclass('public.coach_absences') is not null
  union all
  -- Senza questa nessuno ha nome e foto: si viene riconosciuti dall'email.
  select '0013 — nome e foto del profilo',
         to_regprocedure('public.save_my_profile(text,text)') is not null
  union all
  -- Senza questa non ci sono allievi, questionario né valutazioni.
  select '0014 — allievi, questionario e valutazioni',
         to_regclass('public.intake_answers') is not null
     and to_regprocedure('public.list_people()') is not null
  union all
  -- Senza questa non si possono scrivere né leggere le schede.
  select '0015 — schede di allenamento',
         to_regclass('public.workouts') is not null
     and to_regprocedure('public.get_my_workout()') is not null
  union all
  -- Senza questa in Allievi vedi indirizzi email invece di nomi.
  select '0016 — nome e cognome nell''elenco',
         to_regprocedure('public.set_my_name(text)') is not null
  union all
  -- Senza questa non puoi iscrivere un allievo né archiviarlo, e
  -- nessuno vede gli orari del proprio coach.
  select '0017 — iscritti, archivio, password',
         to_regprocedure('public.get_my_membership()') is not null
     and to_regclass('public.password_resets') is not null
  union all
  -- Senza questa l'allievo non sa mai che la scheda è arrivata.
  select '0018 — avviso sulla scheda',
         to_regprocedure('public.push_targets(uuid,text)') is not null
     and exists (select 1 from information_schema.parameters
                 where specific_schema = 'public' and parameter_name = 'p_notify'
                   and specific_name like 'save_workout%')
)
select migrazione,
       case when applicata then 'sì' else 'DA FARE' end as applicata
from esiti
order by migrazione;
