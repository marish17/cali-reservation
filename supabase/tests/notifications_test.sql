-- Notifiche dentro l'app: conteggio novità per l'utente e coda del coach.
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
select c.id, w, '18:00', '19:00', 5 from coaches c, generate_series(0,6) w;

create table ctx as
  select (app_today() + 2) as day,
         (select ga.slot_id from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as slot_id;

\echo '== 1. nessuna novità prima di prenotare =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select my_updates_count() as novita;

\echo '== 2. una richiesta in attesa non è ancora una novità =='
select 1 from request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true);
select my_updates_count() as novita;

\echo '== 3. la coda del coach conta la richiesta =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select pending_count() as da_evadere;

\echo '== 4. dopo l approvazione, l utente ha una novità =='
select 1 from decide_booking((select id from bookings where email='anna@test.it'), 'approved', 'Ci vediamo!');
set test.uid = '11111111-1111-1111-1111-111111111111';
select my_updates_count() as novita;

\echo '== 5. la coda del coach si è svuotata =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select pending_count() as da_evadere;

\echo '== 6. l utente apre la pagina: la novità viene segnata come letta =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select mark_notifications_seen() is not null as segnata;
select my_updates_count() as novita;

\echo '== 7. un annullamento successivo torna a essere una novità =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select 1 from decide_booking((select id from bookings where email='anna@test.it'), 'cancelled', 'Imprevisto');
set test.uid = '11111111-1111-1111-1111-111111111111';
select my_updates_count() as novita;

\echo '== 8. le novità di un utente non sono quelle di un altro =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select my_updates_count() as novita_di_bruno;

\echo '== 9. la coda del coach è riservata ai coach =='
do $$ begin
  perform pending_count();
  raise exception 'FALLITO: coda visibile a un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 10. senza sessione non si segna nulla come letto =='
set test.uid = '';
do $$ begin
  perform mark_notifications_seen();
  raise exception 'FALLITO: lettura segnata senza sessione';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
