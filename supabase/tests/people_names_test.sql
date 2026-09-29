-- Nome e cognome nell'elenco persone, da qualunque parte arrivino.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('33333333-3333-3333-3333-333333333333', 'carla@test.it'),
  ('44444444-4444-4444-4444-444444444444', 'dino@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

insert into coaches (name) values ('Test Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '10:00', '11:00', 5 from coaches c, generate_series(0,6) w;
update settings set max_trials_per_day = 20;

\echo '== 1. chi ha scelto il nome dal profilo =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select save_my_profile('Anna Rossi');

\echo '== 2. chi ha solo prenotato: il nome sta nel modulo della prova =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select 1 from request_trial(
  (select ga.slot_id from get_availability(app_today()+2, app_today()+2) ga limit 1),
  app_today()+2, 'Bruno Verdi', (app_today() - interval '30 years')::date, '3331112223', true);

\echo '== 3. chi si e registrato e basta: dichiara il nome all iscrizione =='
set test.uid = '33333333-3333-3333-3333-333333333333';
select set_my_name('  Carla Blu  ');

\echo '== 4. chi non ha proprio nulla resta senza nome, non inventiamo =='
-- Dino esiste come account e basta.

\echo '== 5. il coach vede i nomi, non gli indirizzi =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select email, display_name from list_people() order by email;

\echo '== 6. il nome scelto dal profilo vince su quello della prenotazione =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select save_my_profile('Bruno V.');
set test.uid = '99999999-9999-9999-9999-999999999999';
select display_name as bruno from list_people() where email = 'bruno@test.it';

\echo '== 7. set_my_name non sovrascrive un nome gia scelto =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select set_my_name('Qualcun Altro');
select display_name as anna from get_my_profile();

\echo '== 8. un nome vuoto non e un errore, semplicemente non si scrive =='
set test.uid = '44444444-4444-4444-4444-444444444444';
select set_my_name('   ');
set test.uid = '99999999-9999-9999-9999-999999999999';
select display_name is null as dino_senza_nome from list_people() where email = 'dino@test.it';

\echo '== 9. senza sessione non si scrive il nome di nessuno =='
set test.uid = '';
do $$ begin
  perform set_my_name('Intruso');
  raise exception 'FALLITO: nome scritto senza sessione';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 10. un nome lunghissimo viene rifiutato =='
set test.uid = '44444444-4444-4444-4444-444444444444';
do $$ begin
  perform set_my_name(repeat('a', 81));
  raise exception 'FALLITO: nome lunghissimo accettato';
exception when others then
  if sqlerrm like '%NAME_TOO_LONG%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 11. l elenco resta in ordine di nome =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select display_name, email from list_people();

\echo '== TUTTI I TEST SUPERATI =='
