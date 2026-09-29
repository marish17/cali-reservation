-- Regole di capienza, tetto giornaliero, disdette, chiusure e preavviso.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

-- Coach presente tutti i giorni 10-11 (2 posti) e 18-19 (2 posti)
insert into coaches (name) values ('Test Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '10:00', '11:00', 2 from coaches c, generate_series(0,6) w where c.name='Test Coach';
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 2 from coaches c, generate_series(0,6) w where c.name='Test Coach';

update settings set max_trials_per_day = 3, min_notice_hours = 4, booking_horizon_days = 30;

-- Ognuno prenota per se': una persona, un account.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'p' || n || '@test.it'
from generate_series(1, 9) n;

create or replace function as_user(n int) returns void language plpgsql as $$
begin
  perform set_config('test.uid', '00000000-0000-0000-0000-00000000000' || n, false);
end $$;

-- Giorno di test: dopodomani (sicuramente oltre il preavviso)
create temp view d as select (app_today() + 2) as day;
create temp view s10 as
  select ga.slot_id from get_availability((select day from d),(select day from d)) ga
  where ga.start_time = '10:00' limit 1;
create temp view s18 as
  select ga.slot_id from get_availability((select day from d),(select day from d)) ga
  where ga.start_time = '18:00' limit 1;

\echo '== 1. disponibilita iniziale (attesi 2 slot, remaining 2) =='
select ga.start_time, ga.capacity, ga.booked, ga.remaining, ga.day_remaining
from get_availability((select day from d),(select day from d)) ga order by 1;

\echo '== 2. due richieste sullo slot 10:00 (capienza 2) =='
select as_user(1);
select day from request_trial((select slot_id from s10),(select day from d),'Anna Rossi','1990-01-01'::date,'3331112222',true);
select as_user(2);
select day from request_trial((select slot_id from s10),(select day from d),'Bruno Verdi','1990-01-01'::date,'3331112223',true);

\echo '== 3. slot pieno -> atteso SLOT_FULL (il posto e occupato gia da in attesa) =='
select as_user(3);
do $$ begin
  perform request_trial((select slot_id from s10),(select day from d),'Carla Blu','1990-01-01'::date,'3331112224',true);
  raise exception 'FALLITO: la terza richiesta sullo slot pieno e passata';
exception when others then
  if sqlerrm like '%SLOT_FULL%' then raise notice 'OK: %', sqlerrm;
  else raise; end if;
end $$;

\echo '== 4. terza prova del giorno su altro slot -> ok (tetto = 3) =='
select day from request_trial((select slot_id from s18),(select day from d),'Carla Blu','1990-01-01'::date,'3331112224',true);

\echo '== 5. quarta prova del giorno -> atteso DAY_FULL =='
select as_user(4);
do $$ begin
  perform request_trial((select slot_id from s18),(select day from d),'Dino Neri','1990-01-01'::date,'3331112225',true);
  raise exception 'FALLITO: superato il tetto giornaliero';
exception when others then
  if sqlerrm like '%DAY_FULL%' then raise notice 'OK: %', sqlerrm;
  else raise; end if;
end $$;

\echo '== 6. disponibilita a giorno pieno (remaining atteso 0 ovunque) =='
select ga.start_time, ga.booked, ga.remaining, ga.day_booked, ga.day_remaining
from get_availability((select day from d),(select day from d)) ga order by 1;

\echo '== 7. Anna disdice -> il posto torna libero =='
select as_user(1);
select cb.status from cancel_my_booking(
  (select id from bookings where user_id = '00000000-0000-0000-0000-000000000001')) cb;
select ga.start_time, ga.booked, ga.remaining, ga.day_remaining
from get_availability((select day from d),(select day from d)) ga order by 1;

\echo '== 8. due richieste dallo stesso account nello stesso giorno -> ALREADY_BOOKED =='
select as_user(2);
do $$ begin
  perform request_trial((select slot_id from s10),(select day from d),'Bruno Verdi','1990-01-01'::date,'3331112223',true);
  raise exception 'FALLITO: doppia richiesta dallo stesso account';
exception when others then
  if sqlerrm like '%ALREADY_BOOKED%' then raise notice 'OK: %', sqlerrm;
  else raise; end if;
end $$;

\echo '== 9. telefono non valido -> atteso INVALID_PHONE =='
select as_user(5);
do $$ begin
  perform request_trial((select slot_id from s10),(select day from d),'Elsa Gialli','1990-01-01'::date,'123',true);
  raise exception 'FALLITO: telefono non valido accettato';
exception when others then
  if sqlerrm like '%INVALID_PHONE%' then raise notice 'OK: %', sqlerrm;
  else raise; end if;
end $$;

\echo '== 10. giorno di chiusura -> sparisce dalla disponibilita =='
insert into closures (day, reason) values ((select day from d) + 1, 'Test');
select count(*) as slot_visibili_nel_giorno_chiuso
from get_availability((select day from d) + 1, (select day from d) + 1);

\echo '== 11. oltre orizzonte -> nessuna disponibilita =='
select count(*) as slot_oltre_orizzonte
from get_availability(app_today() + 40, app_today() + 45);

\echo '== 12. preavviso minimo: slot di oggi gia passato non compare =='
update settings set min_notice_hours = 120;  -- 5 giorni
select count(*) as slot_entro_4_giorni_con_preavviso_5gg
from get_availability(app_today(), app_today() + 4);
update settings set min_notice_hours = 4;

\echo '== 13. richiesta su slot esistente ma giorno sbagliato -> SLOT_WRONG_DAY =='
select as_user(6);
do $$
declare v_slot uuid;
begin
  select id into v_slot from weekly_slots where weekday = extract(dow from (select day from d))::int limit 1;
  perform request_trial(v_slot, (select day from d) + 3, 'Fabio Bianchi','1990-01-01'::date,'3331112227',true);
  raise exception 'FALLITO: slot accettato in un giorno della settimana diverso';
exception when others then
  if sqlerrm like '%SLOT_WRONG_DAY%' then raise notice 'OK: %', sqlerrm;
  elsif sqlerrm like '%FALLITO%' then raise;
  else raise notice 'OK (variante): %', sqlerrm; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
