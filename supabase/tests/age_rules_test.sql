-- Regole di eta' e accompagnamento.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into coaches (name) values ('Test Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '10:00', '11:00', 5 from coaches c, generate_series(0,6) w where c.name='Test Coach';

update settings set max_trials_per_day = 20, min_age = 8, guardian_required_under_age = 14;

-- Una persona per prova: ognuno prenota per se', quindi ognuno ha un account.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'p' || n || '@test.it'
from generate_series(1, 9) n;

create temp view d as select (app_today() + 2) as day;
create temp view sl as
  select ga.slot_id from get_availability((select day from d),(select day from d)) ga limit 1;

-- Data di nascita che da' esattamente N anni il giorno della prova
create or replace function born_for_age(years int) returns date language sql as $$
  select ((select day from d) - make_interval(years => years))::date;
$$;

-- Accorcia le chiamate: cambia solo chi prenota e con quali dati.
create or replace function as_user(n int) returns void language plpgsql as $$
begin
  perform set_config('test.uid', '00000000-0000-0000-0000-00000000000' || n, false);
end $$;

\echo '== 1. adulto (30 anni), nessun accompagnatore richiesto =='
select as_user(1);
select rt.age, rt.guardian_required
from request_trial((select slot_id from sl),(select day from d),'Anna Rossi',born_for_age(30),'3331112222',true) rt;

\echo '== 2. 20 anni: dati accompagnatore inviati per sbaglio -> scartati =='
select as_user(2);
select rt.age, rt.guardian_required
from request_trial((select slot_id from sl),(select day from d),'Bruno Verdi',born_for_age(20),'3331112223',true,'Mamma Verdi','3339998888') rt;
select guardian_name, guardian_phone from bookings where full_name='Bruno Verdi';

\echo '== 3. 7 anni (minimo 8) -> atteso AGE_TOO_LOW =='
select as_user(3);
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Carla Blu',born_for_age(7),'3331112224',true,'Papa Blu','3339998887');
  raise exception 'FALLITO: accettato sotto l eta minima';
exception when others then
  if sqlerrm like '%AGE_TOO_LOW%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 4. 12 anni senza accompagnatore -> atteso GUARDIAN_REQUIRED =='
select as_user(4);
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Dino Neri',born_for_age(12),'3331112225',true);
  raise exception 'FALLITO: minore accettato senza accompagnatore';
exception when others then
  if sqlerrm like '%GUARDIAN_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 5. 12 anni con nome ma senza telefono -> atteso GUARDIAN_PHONE_REQUIRED =='
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Dino Neri',born_for_age(12),'3331112225',true,'Luca Neri',null);
  raise exception 'FALLITO: accompagnatore senza recapito accettato';
exception when others then
  if sqlerrm like '%GUARDIAN_PHONE_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 6. 12 anni con accompagnatore completo -> ok e dati conservati =='
select rt.age, rt.guardian_required
from request_trial((select slot_id from sl),(select day from d),'Dino Neri',born_for_age(12),'3331112225',true,'Luca Neri','3337776666') rt;
select guardian_name, guardian_phone from bookings where full_name='Dino Neri';

\echo '== 7. compie 14 anni il giorno della prova -> nessun accompagnatore =='
select as_user(5);
select rt.age, rt.guardian_required
from request_trial((select slot_id from sl),(select day from d),'Elsa Gialli',born_for_age(14),'3331112226',true) rt;

\echo '== 8. li compie il giorno DOPO la prova -> ancora 13, accompagnatore =='
select as_user(6);
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Furio Rosa',
    ((select day from d) - make_interval(years => 14) + interval '1 day')::date,'3331112227',true);
  raise exception 'FALLITO: 13enne accettato senza accompagnatore';
exception when others then
  if sqlerrm like '%GUARDIAN_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 9. data di nascita nel futuro -> atteso INVALID_BIRTH_DATE =='
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Gino Viola',app_today() + 10,'3331112228',true);
  raise exception 'FALLITO: data di nascita futura accettata';
exception when others then
  if sqlerrm like '%INVALID_BIRTH_DATE%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 10. data di nascita mancante -> atteso INVALID_BIRTH_DATE =='
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Ivo Grigi',null,'3331112229',true);
  raise exception 'FALLITO: data di nascita nulla accettata';
exception when others then
  if sqlerrm like '%INVALID_BIRTH_DATE%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 11. solo il nome senza cognome -> atteso INVALID_NAME =='
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Marco',born_for_age(25),'3331112230',true);
  raise exception 'FALLITO: nome senza cognome accettato';
exception when others then
  if sqlerrm like '%INVALID_NAME%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 12. le soglie sono configurabili: minimo 16, accompagnatore sotto 18 =='
update settings set min_age = 16, guardian_required_under_age = 18;
select as_user(7);
do $$ begin
  perform request_trial((select slot_id from sl),(select day from d),'Nina Lilla',born_for_age(15),'3331112231',true,'Ada Lilla','3335554444');
  raise exception 'FALLITO: 15enne accettato con minimo a 16';
exception when others then
  if sqlerrm like '%AGE_TOO_LOW%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
select as_user(8);
select rt.age, rt.guardian_required
from request_trial((select slot_id from sl),(select day from d),'Olga Rosa',born_for_age(17),'3331112232',true,'Ada Rosa','3335554443') rt;

\echo '== 13. le impostazioni pubbliche espongono le soglie al form =='
select min_age, guardian_required_under_age from get_public_settings();

\echo '== TUTTI I TEST SUPERATI =='
