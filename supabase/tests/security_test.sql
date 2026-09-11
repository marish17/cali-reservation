-- Chi puo' leggere cosa. Da eseguire su un database usa-e-getta dopo
-- tutte le migrazioni, con i privilegi che Supabase concede di default
-- ai ruoli anon e authenticated (vedi README).
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 2 from coaches c, generate_series(0,6) w;

-- Il contesto va letto anche dai ruoli di prova, altrimenti un
-- inserimento "di prova" non inserisce nulla e sembra rifiutato.
create table test_ctx as
  select (app_today() + 2) as day,
         (select ga.slot_id  from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as slot_id,
         (select ga.coach_id from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as coach_id;
grant select on test_ctx to anon, authenticated;

-- Due prenotazioni reali, di due persone diverse
set test.uid = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select 1 from request_trial((select slot_id from test_ctx),(select day from test_ctx),'Anna Rossi',
  ((select day from test_ctx) - interval '30 years')::date,'3331112222');
reset role;
set test.uid = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select 1 from request_trial((select slot_id from test_ctx),(select day from test_ctx),'Bruno Verdi',
  ((select day from test_ctx) - interval '25 years')::date,'3331112223');
reset role;

\echo ''
\echo '== VISITATORE NON REGISTRATO (ruolo anon) =='
set test.uid = '';
set role anon;
\echo 'prenotazioni visibili (atteso 0):'
select count(*) from bookings;
\echo 'profili visibili (atteso 0):'
select count(*) from profiles;
\echo 'anagrafica coach visibile (atteso 0):'
select count(*) from coaches;
\echo 'impostazioni interne visibili (atteso 0):'
select count(*) from settings;
\echo 'elenco amministratori visibile (atteso 0):'
select count(*) from admins;
\echo 'disponibilita pubblica raggiungibile (atteso > 0):'
select count(*) > 0 as ok from get_availability((select day from test_ctx),(select day from test_ctx));
reset role;

\echo ''
\echo '== UTENTE REGISTRATO: Bruno (ruolo authenticated) =='
set test.uid = '22222222-2222-2222-2222-222222222222';
set role authenticated;
\echo 'prenotazioni visibili (atteso 1, solo la sua):'
select count(*) from bookings;
\echo 'di chi sono (atteso solo Bruno Verdi):'
select full_name from bookings;
\echo 'profili visibili (atteso 1, solo il suo):'
select count(*) from profiles;
\echo 'elenco amministratori visibile (atteso 0):'
select count(*) from admins;
\echo 'puo cambiare lo stato di una prenotazione? (atteso 0 righe toccate):'
with t as (update bookings set status = 'approved' where true returning 1)
select count(*) from t;
\echo 'puo inserire una prenotazione a mano scavalcando i controlli? (atteso errore o 0):'
do $$
declare v_slot uuid; v_coach uuid; v_day date; v_n int;
begin
  select slot_id, coach_id, day into v_slot, v_coach, v_day from test_ctx;
  if v_slot is null then
    raise exception 'TEST ROTTO: nessuno slot nel contesto';
  end if;

  insert into bookings (slot_id, coach_id, day, start_time, end_time, full_name,
                        email, phone, user_id, status)
  values (v_slot, v_coach, v_day, '18:00', '19:00', 'Furbo Furbi',
          'furbo@test.it', '3330000000', '22222222-2222-2222-2222-222222222222', 'approved');

  get diagnostics v_n = row_count;
  raise notice 'ATTENZIONE: inserimento diretto riuscito (% righe)', v_n;
exception
  when insufficient_privilege then raise notice 'OK: inserimento diretto rifiutato dalla RLS';
  when others then raise notice 'OK: inserimento diretto rifiutato (%: %)', sqlstate, sqlerrm;
end $$;

\echo 'puo leggere gli orari interni o le chiusure? (atteso 0):'
select (select count(*) from weekly_slots) as orari, (select count(*) from closures) as chiusure;
reset role;

\echo ''
\echo '== COACH (ruolo authenticated + riga in admins) =='
set test.uid = '99999999-9999-9999-9999-999999999999';
set role authenticated;
\echo 'prenotazioni visibili (atteso 2):'
select count(*) from bookings;
\echo 'profili visibili (atteso 2):'
select count(*) from profiles;
\echo 'puo modificare gli orari (atteso true):'
select count(*) > 0 as ok from weekly_slots;
reset role;

\echo ''
\echo '== FINE =='
