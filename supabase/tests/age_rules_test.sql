-- Regole di eta' e accompagnamento. Da eseguire su un database
-- usa-e-getta dopo 0001_init.sql e 0002_age_and_guardian.sql.
\set ON_ERROR_STOP on
\pset pager off

insert into coaches (name) values ('Test Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '10:00', '11:00', 5 from coaches c, generate_series(0,6) w where c.name='Test Coach';

update settings set max_trials_per_day = 20, min_age = 8, guardian_required_under_age = 14;

create temp view d as select (app_today() + 2) as day;
create temp view sl as
  select ga.slot_id from get_availability((select day from d),(select day from d)) ga limit 1;

-- Data di nascita che da' esattamente N anni il giorno della prova
create or replace function born_for_age(years int) returns date language sql as $$
  select ((select day from d) - make_interval(years => years))::date;
$$;

\echo '== 1. adulto (30 anni), nessun accompagnatore richiesto =='
select bt.age, bt.guardian_required
from book_trial((select slot_id from sl),(select day from d),'Anna Rossi',born_for_age(30),'anna@test.it','3331112222') bt;

\echo '== 2. 20 anni: dati accompagnatore inviati per sbaglio -> scartati =='
select bt.age, bt.guardian_required
from book_trial((select slot_id from sl),(select day from d),'Bruno Verdi',born_for_age(20),'bruno@test.it','3331112223','Mamma Verdi','3339998888') bt;
select guardian_name, guardian_phone from bookings where email='bruno@test.it';

\echo '== 3. 7 anni (minimo 8) -> atteso AGE_TOO_LOW =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Carla Blu',born_for_age(7),'carla@test.it','3331112224','Papa Blu','3339998887');
  raise exception 'FALLITO: accettato sotto l eta minima';
exception when others then
  if sqlerrm like '%AGE_TOO_LOW%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 4. 12 anni senza accompagnatore -> atteso GUARDIAN_REQUIRED =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Dino Neri',born_for_age(12),'dino@test.it','3331112225');
  raise exception 'FALLITO: minore accettato senza accompagnatore';
exception when others then
  if sqlerrm like '%GUARDIAN_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 5. 12 anni con nome ma senza telefono -> atteso GUARDIAN_PHONE_REQUIRED =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Dino Neri',born_for_age(12),'dino@test.it','3331112225','Luca Neri',null);
  raise exception 'FALLITO: accompagnatore senza recapito accettato';
exception when others then
  if sqlerrm like '%GUARDIAN_PHONE_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 6. 12 anni con accompagnatore completo -> ok e dati conservati =='
select bt.age, bt.guardian_required
from book_trial((select slot_id from sl),(select day from d),'Dino Neri',born_for_age(12),'dino@test.it','3331112225','Luca Neri','3337776666') bt;
select guardian_name, guardian_phone from bookings where email='dino@test.it';

\echo '== 7. compie 14 anni il giorno della prova -> nessun accompagnatore =='
select bt.age, bt.guardian_required
from book_trial((select slot_id from sl),(select day from d),'Elsa Gialli',born_for_age(14),'elsa@test.it','3331112226') bt;

\echo '== 8. li compie il giorno DOPO la prova -> ancora 13, accompagnatore =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Furio Rosa',
    ((select day from d) - make_interval(years => 14) + interval '1 day')::date,'furio@test.it','3331112227');
  raise exception 'FALLITO: 13enne accettato senza accompagnatore';
exception when others then
  if sqlerrm like '%GUARDIAN_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 9. data di nascita nel futuro -> atteso INVALID_BIRTH_DATE =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Gino Viola',app_today() + 10,'gino@test.it','3331112228');
  raise exception 'FALLITO: data di nascita futura accettata';
exception when others then
  if sqlerrm like '%INVALID_BIRTH_DATE%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 10. data di nascita mancante -> atteso INVALID_BIRTH_DATE =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Ivo Grigi',null,'ivo@test.it','3331112229');
  raise exception 'FALLITO: data di nascita nulla accettata';
exception when others then
  if sqlerrm like '%INVALID_BIRTH_DATE%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 11. solo il nome senza cognome -> atteso INVALID_NAME =='
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Marco',born_for_age(25),'marco@test.it','3331112230');
  raise exception 'FALLITO: nome senza cognome accettato';
exception when others then
  if sqlerrm like '%INVALID_NAME%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 12. le soglie sono configurabili: minimo 16, accompagnatore sotto 18 =='
update settings set min_age = 16, guardian_required_under_age = 18;
do $$ begin
  perform book_trial((select slot_id from sl),(select day from d),'Nina Lilla',born_for_age(15),'nina@test.it','3331112231','Ada Lilla','3335554444');
  raise exception 'FALLITO: 15enne accettato con minimo a 16';
exception when others then
  if sqlerrm like '%AGE_TOO_LOW%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
select bt.age, bt.guardian_required
from book_trial((select slot_id from sl),(select day from d),'Olga Rosa',born_for_age(17),'olga@test.it','3331112232','Ada Rosa','3335554443') bt;

\echo '== 13. le impostazioni pubbliche espongono le soglie al form =='
select min_age, guardian_required_under_age from get_public_settings();

\echo '== TUTTI I TEST SUPERATI =='
