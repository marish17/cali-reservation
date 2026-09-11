-- Annullamento di una prova da parte del coach.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 1 from coaches c, generate_series(0,6) w;

create table ctx as
  select (app_today() + 2) as day,
         (select ga.slot_id from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as slot_id;

set test.uid = '11111111-1111-1111-1111-111111111111';
select 1 from request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true);

\echo '== 1. il coach conferma la prova =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select db.status from decide_booking((select id from bookings where email='anna@test.it'), 'approved') db;

\echo '== 2. lo slot (capienza 1) risulta pieno =='
select ga.remaining from get_availability((select day from ctx),(select day from ctx)) ga;

\echo '== 3. imprevisto: il coach annulla, con motivo =='
select db.status, db.note, db.phone
from decide_booking((select id from bookings where email='anna@test.it'), 'cancelled', 'Imprevisto del coach') db;

\echo '== 4. il posto torna libero =='
select ga.remaining from get_availability((select day from ctx),(select day from ctx)) ga;

\echo '== 5. si distingue da una disdetta della persona (cancelled_at + decided_by) =='
select cancelled_at is not null as annullata,
       decided_by is not null   as annullata_dal_coach
from bookings where email = 'anna@test.it';

\echo '== 6. un altro utente puo ora prendere il posto =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select rt.status from request_trial((select slot_id from ctx),(select day from ctx),'Bruno Verdi',
  ((select day from ctx) - interval '25 years')::date,'3331112223', true) rt;

\echo '== 7. annullare due volte -> atteso ALREADY_CANCELLED =='
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform decide_booking((select id from bookings where email='anna@test.it'), 'cancelled');
  raise exception 'FALLITO: doppio annullamento riuscito';
exception when others then
  if sqlerrm like '%ALREADY_CANCELLED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 8. un utente qualunque non puo annullare la prova di un altro =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform decide_booking((select id from bookings where email='bruno@test.it'), 'cancelled');
  raise exception 'FALLITO: annullamento da parte di un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 9. stato inventato -> atteso INVALID_STATUS =='
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform decide_booking((select id from bookings where email='bruno@test.it'), 'forse');
  raise exception 'FALLITO: stato arbitrario accettato';
exception when others then
  if sqlerrm like '%INVALID_STATUS%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
