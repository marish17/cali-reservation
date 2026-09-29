-- Nome e foto del profilo.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'luca@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'luca@test.it');

\echo '== 1. senza sessione non si salva nulla =='
do $$ begin
  perform save_my_profile('Tizio');
  raise exception 'FALLITO: profilo salvato senza sessione';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. chi non ha mai prenotato ha comunque un profilo leggibile =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select display_name is null as senza_nome, email from get_my_profile();

\echo '== 3. salvataggio di nome e foto =='
select save_my_profile('Luca Bianchi', '99999999-9999-9999-9999-999999999999/avatar.jpg');
select display_name, avatar_path from get_my_profile();

\echo '== 4. il nome si aggiorna, non si duplica =='
select save_my_profile('Luca B.');
select count(*) as righe_profilo from profiles where user_id = '99999999-9999-9999-9999-999999999999';
select display_name from get_my_profile();

\echo '== 5. un nome troppo lungo viene rifiutato =='
do $$ begin
  perform save_my_profile(repeat('a', 81));
  raise exception 'FALLITO: nome lunghissimo accettato';
exception when others then
  if sqlerrm like '%NAME_TOO_LONG%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 6. il nome del profilo non tocca quello sulla prenotazione =='
insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 5 from coaches c, generate_series(0,6) w;
set test.uid = '11111111-1111-1111-1111-111111111111';
select save_my_profile('Mamma Rossi');
select 1 from request_trial(
  (select ga.slot_id from get_availability(app_today()+2, app_today()+2) ga limit 1),
  app_today()+2, 'Figlio Rossi', (app_today() - interval '12 years')::date, '3331112222', true,
  'Mamma Rossi', '3331112222');
select display_name, full_name from profiles where user_id = '11111111-1111-1111-1111-111111111111';
select full_name as nome_sulla_prova from bookings where user_id = '11111111-1111-1111-1111-111111111111';

\echo '== 7. ognuno legge solo il proprio profilo =='
select display_name as visto_da_anna from get_my_profile();

\echo '== 8. l elenco accessi mostra il nome =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select admin_email, display_name from list_admins();

\echo '== TUTTI I TEST SUPERATI =='
