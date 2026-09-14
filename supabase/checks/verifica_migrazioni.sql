-- Dice quali migrazioni risultano applicate al database.
-- Da incollare nel SQL Editor di Supabase: risponde con un elenco
-- leggibile, non tocca nulla.

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
-- Senza questa il bottone "Annulla la prova" nel pannello dà errore.
select '0007 — annullamento dal coach',
       to_regprocedure('public.decide_booking(uuid,text,text)') is not null
   and exists (select 1 from information_schema.parameters
               where specific_schema = 'public'
                 and parameter_name = 'phone'
                 and specific_name like 'decide_booking%')
union all
-- Senza questa i contatori delle notifiche non funzionano.
select '0008 — notifiche nell''app',
       to_regprocedure('public.my_updates_count()') is not null
order by 1;
