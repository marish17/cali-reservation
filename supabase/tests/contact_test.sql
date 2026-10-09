-- Telefono obbligatorio alla registrazione, e recapiti nell'elenco.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('33333333-3333-3333-3333-333333333333', 'carla@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

insert into coaches (name) values ('Test Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '10:00', '11:00', 5 from coaches c, generate_series(0,6) w;
update settings set max_trials_per_day = 20;

\echo '== 1. un numero che non e un numero viene rifiutato =='
select valid_phone('333 111 2222') as buono,
       valid_phone('+39 333 1112222') as col_prefisso,
       valid_phone('12345') as troppo_corto,
       valid_phone('non so') as testo,
       valid_phone(null) as nullo;

\echo '== 2. alla registrazione si salvano nome e telefono insieme =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select set_my_name('Anna Rossi', '333 111 2222');
select display_name, phone, email from get_my_profile();

\echo '== 3. un numero sbagliato ferma il salvataggio =='
set test.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform set_my_name('Bruno Verdi', '123');
  raise exception 'FALLITO: numero non valido accettato';
exception when others then
  if sqlerrm like '%INVALID_PHONE%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
select count(*) as profilo_di_bruno from profiles where user_id = '22222222-2222-2222-2222-222222222222';

\echo '== 4. non sovrascrive quello che c e gia =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select set_my_name('Qualcun Altro', '3339998888');
select display_name, phone from get_my_profile();

\echo '== 5. dal profilo invece il numero si cambia davvero =='
select save_my_phone('334 555 6677');
select phone from get_my_profile();

\echo '== 6. e non si puo svuotare per sbaglio =='
do $$ begin
  perform save_my_phone('   ');
  raise exception 'FALLITO: numero svuotato';
exception when others then
  if sqlerrm like '%INVALID_PHONE%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
select phone as rimasto from get_my_profile();

\echo '== 7. senza sessione non si tocca il recapito di nessuno =='
set test.uid = '';
do $$ begin
  perform save_my_phone('3331112222');
  raise exception 'FALLITO: numero scritto senza sessione';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 8. chi ha prenotato prima di oggi: il numero si recupera dalla prova =='
set test.uid = '33333333-3333-3333-3333-333333333333';
select 1 from request_trial(
  (select ga.slot_id from get_availability(app_today()+2, app_today()+2) ga limit 1),
  app_today()+2, 'Carla Blu', (app_today() - interval '25 years')::date, '3387776655', true);
-- Il profilo nasce dalla prenotazione, quindi il numero c'e' gia.
select phone as dal_modulo_della_prova from get_my_profile();

\echo '== 9. l elenco del coach porta nome, email e telefono =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select display_name, email, phone from list_people() order by email;

\echo '== 10. chi non ha dato il numero si vede, non si inventa =='
select email, phone is null as senza_telefono
from list_people() where email = 'bruno@test.it';

\echo '== 11. l elenco resta riservato ai coach =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform list_people();
  raise exception 'FALLITO: recapiti visibili a un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
