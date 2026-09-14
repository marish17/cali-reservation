-- Registrazione dei dispositivi e scelta dei destinatari delle push.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it'),
  ('88888888-8888-8888-8888-888888888888', 'coach2@test.it');
insert into admins (user_id, email) values
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it'),
  ('88888888-8888-8888-8888-888888888888', 'coach2@test.it');
insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 5 from coaches c, generate_series(0,6) w;

create table ctx as
  select (app_today() + 2) as day,
         (select ga.slot_id from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as slot_id;

\echo '== 1. senza sessione non si registra un dispositivo =='
do $$ begin
  perform save_push_subscription('https://push.example/x', 'k', 'a');
  raise exception 'FALLITO: dispositivo registrato senza sessione';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. ognuno registra i propri dispositivi =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select save_push_subscription('https://push.example/anna-telefono', 'k1', 'a1', 'iPhone');
select save_push_subscription('https://push.example/anna-pc', 'k2', 'a2', 'Mac');
set test.uid = '99999999-9999-9999-9999-999999999999';
select save_push_subscription('https://push.example/coach1', 'k3', 'a3', 'Android');
set test.uid = '88888888-8888-8888-8888-888888888888';
select save_push_subscription('https://push.example/coach2', 'k4', 'a4', 'iPhone');
select count(*) as dispositivi_totali from push_subscriptions;

\echo '== 3. registrare due volte lo stesso non duplica, aggiorna =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select save_push_subscription('https://push.example/anna-telefono', 'k1-nuova', 'a1-nuova', 'iPhone');
select count(*) as dispositivi_di_anna, max(p256dh) as chiave from push_subscriptions
 where user_id = '11111111-1111-1111-1111-111111111111' and endpoint like '%telefono';

\echo '== 4. ciascuno conta solo i propri =='
select my_push_devices() as dispositivi_di_anna;
set test.uid = '99999999-9999-9999-9999-999999999999';
select my_push_devices() as dispositivi_del_coach;

\echo '== 5. nessuno legge i dispositivi altrui =='
set test.uid = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) as dispositivi_visibili_a_bruno from push_subscriptions;
reset role;

\echo '== 6. una nuova richiesta va a tutti i coach, non al richiedente =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select 1 from request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true);
select endpoint, title from push_targets_for_booking(
  (select id from bookings where email='anna@test.it'), 'coaches') order by endpoint;

\echo '== 7. l esito va solo a chi ha prenotato, su tutti i suoi dispositivi =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select 1 from decide_booking((select id from bookings where email='anna@test.it'), 'approved', 'Ci vediamo!');
select endpoint, title, body from push_targets_for_booking(
  (select id from bookings where email='anna@test.it'), 'booker') order by endpoint;

\echo '== 8. un annullamento cambia il messaggio =='
select 1 from decide_booking((select id from bookings where email='anna@test.it'), 'cancelled', 'Imprevisto');
select distinct title, body from push_targets_for_booking(
  (select id from bookings where email='anna@test.it'), 'booker');

\echo '== 9. un recapito scaduto si può dimenticare =='
select forget_push_endpoint('https://push.example/anna-pc');
set test.uid = '11111111-1111-1111-1111-111111111111';
select my_push_devices() as dispositivi_rimasti;

\echo '== 10. si cancella solo il proprio =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select delete_push_subscription('https://push.example/coach1');
select count(*) as coach1_ancora_presente from push_subscriptions where endpoint = 'https://push.example/coach1';

\echo '== 11. una prenotazione inesistente non produce destinatari =='
select count(*) as destinatari from push_targets_for_booking(gen_random_uuid(), 'coaches');

\echo '== TUTTI I TEST SUPERATI =='
