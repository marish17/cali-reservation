-- Gli inneschi che fanno partire le notifiche push.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni,
-- con pg_net simulato (vedi README).
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 5 from coaches c, generate_series(0,6) w;

create table ctx as
  select (app_today() + 2) as day,
         (select ga.slot_id from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as slot_id;

\echo '== 1. senza configurazione non parte nulla, e la prenotazione riesce lo stesso =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select rt.status from request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true) rt;
select count(*) as chiamate_partite from net.calls;

\echo '== 2. configurata, una nuova richiesta chiama la funzione per i coach =='
insert into private_config (key, value) values
  ('push_function_url', 'https://progetto.supabase.co/functions/v1/push'),
  ('push_secret', 'parola-dordine');
delete from net.calls;
set test.uid = '11111111-1111-1111-1111-111111111111';
select 1 from request_trial((select slot_id from ctx),(select day from ctx) + 7,'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true);
select url, body->>'audience' as destinatari, headers->>'x-push-secret' as parola from net.calls;

\echo '== 3. l approvazione chiama la funzione per chi ha prenotato =='
delete from net.calls;
set test.uid = '99999999-9999-9999-9999-999999999999';
select 1 from decide_booking((select id from bookings where day = (select day from ctx)), 'approved');
select body->>'audience' as destinatari from net.calls;

\echo '== 4. la disdetta fatta dalla persona non le viene annunciata =='
delete from net.calls;
set test.uid = '11111111-1111-1111-1111-111111111111';
select 1 from cancel_my_booking((select id from bookings where day = (select day from ctx) + 7));
select count(*) as chiamate_partite from net.calls;

\echo '== 5. una modifica che non tocca lo stato non spedisce niente =='
delete from net.calls;
update bookings set notes = 'aggiornata' where day = (select day from ctx);
select count(*) as chiamate_partite from net.calls;

\echo '== 6. l annullamento del coach avvisa la persona =='
delete from net.calls;
set test.uid = '99999999-9999-9999-9999-999999999999';
select 1 from decide_booking((select id from bookings where day = (select day from ctx)), 'cancelled', 'Imprevisto');
select body->>'audience' as destinatari from net.calls;

\echo '== 7. la configurazione non è leggibile dagli utenti =='
set test.uid = '11111111-1111-1111-1111-111111111111';
set role authenticated;
do $$
declare v int;
begin
  select count(*) into v from public.private_config;
  raise notice 'ATTENZIONE: configurazione leggibile (% righe)', v;
exception
  when insufficient_privilege then raise notice 'OK: lettura rifiutata';
  when others then raise notice 'OK: lettura rifiutata (%)', sqlstate;
end $$;
reset role;

\echo '== TUTTI I TEST SUPERATI =='
