-- Assenze dei coach e collegamento con gli account.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'luca@test.it'),
  ('88888888-8888-8888-8888-888888888888', 'sara@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'estraneo@test.it');
insert into admins (user_id, email) values
  ('99999999-9999-9999-9999-999999999999', 'luca@test.it'),
  ('88888888-8888-8888-8888-888888888888', 'sara@test.it');

insert into coaches (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Luca'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sara');

-- Entrambi presenti tutti i giorni, a orari diversi
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select 'aaaaaaaa-0000-0000-0000-000000000001', w, '18:00', '19:00', 2 from generate_series(0,6) w;
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select 'aaaaaaaa-0000-0000-0000-000000000002', w, '19:00', '20:00', 2 from generate_series(0,6) w;

create table ctx as select (app_today() + 3) as day;

\echo '== 1. prima dell assenza entrambi gli orari sono offerti =='
select coach_name, start_time from get_availability((select day from ctx),(select day from ctx)) order by start_time;

\echo '== 2. collegare un account che non è coach -> atteso NOT_A_COACH =='
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform set_coach_user('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
  raise exception 'FALLITO: collegato un account senza accesso';
exception when others then
  if sqlerrm like '%NOT_A_COACH%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 3. collegamento corretto =='
select set_coach_user('aaaaaaaa-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999');
select name, user_id is not null as collegato from coaches order by name;

\echo '== 4. un estraneo non può collegare né segnare assenze =='
set test.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform set_coach_user('aaaaaaaa-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888');
  raise exception 'FALLITO: collegamento da un estraneo';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 5. una prenotazione su Luca, poi Luca si assenta =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select 1 from request_trial(
  (select ga.slot_id from get_availability((select day from ctx),(select day from ctx)) ga
    where ga.coach_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  (select day from ctx),'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true);

set test.uid = '99999999-9999-9999-9999-999999999999';
\echo 'prove che resterebbero scoperte (attesa 1):'
select full_name, phone, status from bookings_covered_by_coach(
  'aaaaaaaa-0000-0000-0000-000000000001', (select day from ctx), (select day from ctx));

\echo '== 6. segnata l assenza, sparisce solo il suo orario =='
insert into coach_absences (coach_id, from_day, to_day, reason)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select day from ctx), (select day from ctx), 'Imprevisto');
select coach_name, start_time from get_availability((select day from ctx),(select day from ctx)) order by start_time;

\echo '== 7. gli altri giorni di Luca restano =='
select count(*) as fasce_di_luca_il_giorno_dopo
from get_availability((select day from ctx) + 1, (select day from ctx) + 1)
where coach_id = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '== 8. la prenotazione esistente NON viene toccata =='
select full_name, status from bookings where email = 'anna@test.it';

\echo '== 9. un periodo lungo copre tutti i giorni in mezzo =='
insert into coach_absences (coach_id, from_day, to_day, reason)
values ('aaaaaaaa-0000-0000-0000-000000000002', (select day from ctx) + 2, (select day from ctx) + 5, 'Ferie');
select count(*) as fasce_di_sara_nel_periodo
from get_availability((select day from ctx) + 2, (select day from ctx) + 5)
where coach_id = 'aaaaaaaa-0000-0000-0000-000000000002';

\echo '== 10. e non tocca i giorni fuori dal periodo =='
select count(*) as fasce_di_sara_dopo_le_ferie
from get_availability((select day from ctx) + 6, (select day from ctx) + 6)
where coach_id = 'aaaaaaaa-0000-0000-0000-000000000002';

\echo '== 11. un estraneo non vede le prove coperte da un coach =='
set test.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform bookings_covered_by_coach('aaaaaaaa-0000-0000-0000-000000000001', app_today(), app_today() + 30);
  raise exception 'FALLITO: elenco visibile a un estraneo';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
