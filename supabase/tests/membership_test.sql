-- Allievi iscritti, archiviazione, orari del coach, reset di password.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

insert into coaches (name) values ('Marco'), ('Giulia');
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, v.d, v.a, v.b, 2 from coaches c,
  (values (1,'18:00'::time,'19:00'::time), (3,'19:00'::time,'20:00'::time)) v(d,a,b)
where c.name = 'Marco';
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, 5, '10:00', '11:00', 2 from coaches c where c.name = 'Giulia';

\echo '== 1. la riga allievo non si tocca senza essere coach =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform set_student('11111111-1111-1111-1111-111111111111', null, true, null);
  raise exception 'FALLITO: allievo modificato da un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. prima di tutto non e iscritto e non ha coach =='
select enrolled, coach_name, has_workout from get_my_membership();

\echo '== 3. il coach lo iscrive e glielo assegna =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select set_student('11111111-1111-1111-1111-111111111111',
                   (select id from coaches where name='Marco'), true, null);
set test.uid = '11111111-1111-1111-1111-111111111111';
select enrolled, coach_name from get_my_membership();

\echo '== 4. i parametri lasciati nulli non cancellano quelli gia messi =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select set_student('11111111-1111-1111-1111-111111111111', null, null, null);
set test.uid = '11111111-1111-1111-1111-111111111111';
select enrolled, coach_name as coach_rimasto from get_my_membership();

\echo '== 5. gli orari che vede sono solo quelli del suo coach =='
select coach_name, weekday, start_time, end_time from get_my_coach_hours();

\echo '== 6. e le assenze annunciate, non quelle passate =='
set test.uid = '99999999-9999-9999-9999-999999999999';
insert into coach_absences (coach_id, from_day, to_day, reason)
select id, app_today() + 3, app_today() + 4, 'Trasferta' from coaches where name='Marco';
insert into coach_absences (coach_id, from_day, to_day, reason)
select id, app_today() - 20, app_today() - 19, 'Vecchia' from coaches where name='Marco';
insert into coach_absences (coach_id, from_day, to_day, reason)
select id, app_today() + 3, app_today() + 4, 'Di un altro coach' from coaches where name='Giulia';
set test.uid = '11111111-1111-1111-1111-111111111111';
select coach_name, from_day, to_day, reason from get_my_coach_absences();

\echo '== 7. staccare il coach vuol dire nessuno, non "non toccare" =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select clear_student_coach('11111111-1111-1111-1111-111111111111');
set test.uid = '11111111-1111-1111-1111-111111111111';
select coach_name is null as senza_coach, enrolled as ancora_iscritto from get_my_membership();
select count(*) as orari_senza_coach from get_my_coach_hours();

\echo '== 8. archiviare non cancella: la persona resta, esce dall elenco attivo =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select set_student('11111111-1111-1111-1111-111111111111', null, null, false);
select display_name, enrolled, active, is_coach from list_people() order by email;

\echo '== 9. l elenco sa chi ha le chiavi del pannello =='
select email, is_coach from list_people() where email = 'coach@test.it';

\echo '== 10. e chi ha una scheda attiva =='
select save_workout(null, '22222222-2222-2222-2222-222222222222', 'Base',
  '[{"title":"A","body":"x"},{"title":"B","body":"y"}]'::jsonb) is not null as assegnata;
select email, has_workout from list_people() where email = 'bruno@test.it';

\echo '== 11. la traccia dei reset la leggono solo i coach =='
insert into password_resets (target_user_id, target_email, by_user_id, by_email)
values ('11111111-1111-1111-1111-111111111111', 'anna@test.it',
        '99999999-9999-9999-9999-999999999999', 'coach@test.it');
set role authenticated;
select count(*) as visibili_al_coach from password_resets;
reset role;
set test.uid = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) as visibili_a_un_allievo from password_resets;
reset role;

\echo '== 12. l avviso della password sparisce quando se la cambia =='
set test.uid = '11111111-1111-1111-1111-111111111111';
update profiles set password_reset_at = now() where user_id = '11111111-1111-1111-1111-111111111111';
select password_reset_at is not null as avviso_acceso from get_my_membership();
select note_password_changed();
select password_reset_at is null as avviso_spento from get_my_membership();

\echo '== 13. senza sessione non si sa nulla di nessuno =='
set test.uid = '';
do $$ begin
  perform get_my_membership();
  raise exception 'FALLITO: stato letto senza sessione';
exception when others then
  if sqlerrm like '%NOT_AUTHENTICATED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
