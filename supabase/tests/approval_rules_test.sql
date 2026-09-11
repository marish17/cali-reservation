-- Account, richieste in attesa e approvazione del coach.
-- Da eseguire su un database usa-e-getta dopo 0001, 0002 e 0003.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('33333333-3333-3333-3333-333333333333', 'carla@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

insert into admins (user_id, email)
values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 2 from coaches c, generate_series(0,6) w;

update settings set max_trials_per_day = 3, min_age = 8, guardian_required_under_age = 14;

create temp view d as select (app_today() + 2) as day;
create temp view sl as
  select ga.slot_id from get_availability((select day from d),(select day from d)) ga limit 1;
create or replace function born(years int) returns date language sql as $$
  select ((select day from d) - make_interval(years => years))::date;
$$;

\echo '== 1. senza sessione -> atteso NOT_AUTHENTICATED =='
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Anna Rossi',born(30),'3331112222');
  raise exception 'FALLITO: prenotazione senza account';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. utente autenticato -> richiesta in attesa =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select rt.status, rt.age from request_trial((select slot_id from sl),(select day from d),'Anna Rossi',born(30),'3331112222') rt;

\echo '== 3. il profilo viene salvato per la volta successiva =='
select full_name, phone, email from profiles where user_id = '11111111-1111-1111-1111-111111111111';

\echo '== 4. la richiesta in attesa occupa gia il posto (capienza 2 -> resta 1) =='
select ga.capacity, ga.booked, ga.remaining
from get_availability((select day from d),(select day from d)) ga;

\echo '== 5. stesso utente, stesso giorno -> atteso ALREADY_BOOKED =='
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Anna Rossi',born(30),'3331112222');
  raise exception 'FALLITO: due richieste attive nello stesso giorno';
exception when others then
  if sqlerrm like '%ALREADY_BOOKED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 6. secondo utente riempie lo slot, il terzo trova SLOT_FULL =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select rt.status from request_trial((select slot_id from sl),(select day from d),'Bruno Verdi',born(25),'3331112223') rt;
set test.uid = '33333333-3333-3333-3333-333333333333';
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Carla Blu',born(22),'3331112224');
  raise exception 'FALLITO: superata la capienza con richieste in attesa';
exception when others then
  if sqlerrm like '%SLOT_FULL%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 7. un utente non puo approvare la propria richiesta =='
do $$
declare v_id uuid;
begin
  select id into v_id from bookings where email = 'anna@test.it';
  perform decide_booking(v_id, 'approved');
  raise exception 'FALLITO: un utente qualsiasi ha approvato';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 8. il coach approva =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select db.status, db.email, db.note
from decide_booking((select id from bookings where email='anna@test.it'), 'approved', 'Ci vediamo!') db;

\echo '== 9. il coach rifiuta: il posto torna libero =='
select db.status, db.note
from decide_booking((select id from bookings where email='bruno@test.it'), 'rejected', 'Siamo al completo') db;
select ga.booked, ga.remaining from get_availability((select day from d),(select day from d)) ga;

\echo '== 10. dopo il rifiuto il terzo utente riesce a prenotare =='
set test.uid = '33333333-3333-3333-3333-333333333333';
select rt.status from request_trial((select slot_id from sl),(select day from d),'Carla Blu',born(22),'3331112224') rt;

\echo '== 11. stato non valido -> atteso INVALID_STATUS =='
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform decide_booking((select id from bookings where email='carla@test.it'), 'forse');
  raise exception 'FALLITO: stato arbitrario accettato';
exception when others then
  if sqlerrm like '%INVALID_STATUS%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 12. l utente annulla la propria richiesta =='
set test.uid = '33333333-3333-3333-3333-333333333333';
select cb.status from cancel_my_booking((select id from bookings where email='carla@test.it')) cb;

\echo '== 13. e non puo annullare quella di un altro =='
do $$ begin
  perform cancel_my_booking((select id from bookings where email='anna@test.it'));
  raise exception 'FALLITO: annullata la prenotazione di un altro utente';
exception when others then
  if sqlerrm like '%NOT_FOUND%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 14. minore senza accompagnatore -> atteso GUARDIAN_REQUIRED =='
set test.uid = '33333333-3333-3333-3333-333333333333';
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d) + 1,'Dino Neri',born(12),'3331112225');
  raise exception 'FALLITO: minore senza accompagnatore';
exception when others then
  if sqlerrm like '%GUARDIAN_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 15. lo stato finale delle prenotazioni =='
select full_name, status, decision_note from bookings order by full_name;

\echo '== TUTTI I TEST SUPERATI =='
