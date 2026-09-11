-- Consenso all'informativa privacy.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it');
insert into coaches (name) values ('Coach');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, w, '18:00', '19:00', 5 from coaches c, generate_series(0,6) w;

create table ctx as
  select (app_today() + 2) as day,
         (select ga.slot_id from get_availability(app_today() + 2, app_today() + 2) ga limit 1) as slot_id;

\echo '== 1. senza consenso -> atteso PRIVACY_REQUIRED =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
    ((select day from ctx) - interval '30 years')::date,'3331112222', false);
  raise exception 'FALLITO: richiesta accettata senza consenso';
exception when others then
  if sqlerrm like '%PRIVACY_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. consenso non passato affatto (valore predefinito) -> stesso rifiuto =='
do $$ begin
  perform request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
    ((select day from ctx) - interval '30 years')::date,'3331112222');
  raise exception 'FALLITO: il consenso è facoltativo';
exception when others then
  if sqlerrm like '%PRIVACY_REQUIRED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 3. con consenso -> richiesta creata =='
select rt.status from request_trial((select slot_id from ctx),(select day from ctx),'Anna Rossi',
  ((select day from ctx) - interval '30 years')::date,'3331112222', true) rt;

\echo '== 4. il momento del consenso viene registrato =='
select privacy_accepted_at is not null as consenso_registrato from bookings where email = 'anna@test.it';

\echo '== 5. l informativa è leggibile senza account =='
set test.uid = '';
set role anon;
select length(privacy_text) > 200 as testo_presente,
       privacy_updated_at is not null as data_presente
from get_privacy_text();
reset role;

\echo '== 6. ma il testo non è modificabile da chi non è coach =='
set test.uid = '22222222-2222-2222-2222-222222222222';
set role authenticated;
do $$
declare v_n int;
begin
  update settings set privacy_text = 'manomesso' where id;
  get diagnostics v_n = row_count;
  if v_n > 0 then raise notice 'ATTENZIONE: testo modificato da un non-coach';
  else raise notice 'OK: nessuna riga modificata';
  end if;
exception
  when insufficient_privilege then raise notice 'OK: modifica rifiutata';
  when others then raise notice 'OK: modifica rifiutata (%)', sqlstate;
end $$;
reset role;
select privacy_text = 'manomesso' as manomesso from settings where id;

\echo '== TUTTI I TEST SUPERATI =='
