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
       to_regprocedure('public.decide_booking(uuid,text,text)') is not null
union all
select '0004 — nome della palestra',
       exists (select 1 from public.settings where id and gym_name = 'Calisthenics Academy')
union all
select '0005 — gestione accessi',
       to_regprocedure('public.grant_admin(text)') is not null
union all
-- Questa deve essere applicata perché il sito pubblicato possa
-- registrare una richiesta: il modulo invia anche il consenso privacy,
-- e la versione precedente della funzione non lo accetta.
select '0006 — privacy e consenso',
       to_regprocedure('public.request_trial(uuid,date,text,date,text,boolean,text,text,text)') is not null
order by 1;
