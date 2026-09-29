-- Schede di allenamento: scrittura del coach, lettura e note dell'allievo.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into coaches (name) values ('Marco');

\set anna '''11111111-1111-1111-1111-111111111111'''
\set bruno '''22222222-2222-2222-2222-222222222222'''

\echo '== 1. chi non e coach non scrive schede =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform save_workout(null, '11111111-1111-1111-1111-111111111111', 'Scheda mia',
    '[{"title":"A","body":"x"},{"title":"B","body":"y"}]'::jsonb);
  raise exception 'FALLITO: scheda scritta da un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. una scheda ha due o tre giorni, non uno e non quattro =='
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform save_workout(null, '11111111-1111-1111-1111-111111111111', 'Uno solo',
    '[{"title":"A","body":"x"}]'::jsonb);
  raise exception 'FALLITO: scheda a un giorno accettata';
exception when others then
  if sqlerrm like '%WRONG_DAY_COUNT%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
do $$ begin
  perform save_workout(null, '11111111-1111-1111-1111-111111111111', 'Quattro',
    '[{"title":"A"},{"title":"B"},{"title":"C"},{"title":"D"}]'::jsonb);
  raise exception 'FALLITO: scheda a quattro giorni accettata';
exception when others then
  if sqlerrm like '%WRONG_DAY_COUNT%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 3. una scheda senza nome non si salva =='
do $$ begin
  perform save_workout(null, '11111111-1111-1111-1111-111111111111', '   ',
    '[{"title":"A"},{"title":"B"}]'::jsonb);
  raise exception 'FALLITO: scheda senza nome accettata';
exception when others then
  if sqlerrm like '%NO_NAME%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 4. il coach assegna: nasce l allievo e la scheda e attiva =='
select save_workout(null, :anna::uuid, 'Base 3 giorni',
  jsonb_build_array(
    jsonb_build_object('title','Spinta','body','Piegamenti 4x8'),
    jsonb_build_object('title','Tirata','body','Trazioni 4x5'),
    jsonb_build_object('title','Gambe','body','Squat 4x12')),
  'Tre giorni ciclici, riposo fra uno e l altro.',
  (select id from coaches where name='Marco')) as scheda \gset
select (select count(*) from students where user_id = :anna::uuid) as allievo_creato,
       (select count(*) from workout_days where workout_id = :'scheda'::uuid) as giorni;
select id, name, status, days from list_workouts(:anna::uuid);

\echo '== 5. assegnarne una nuova archivia la precedente =='
select save_workout(null, :anna::uuid, 'Blocco forza',
  jsonb_build_array(
    jsonb_build_object('title','A','body','Panca'),
    jsonb_build_object('title','B','body','Stacco'))) as scheda2 \gset
select name, status from list_workouts(:anna::uuid);
select count(*) as attive_contemporanee
from workouts where student_id = :anna::uuid and status = 'active';

\echo '== 6. l allievo legge la sua scheda attiva, e solo quella =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select name, day_position, title, body from get_my_workout();

\echo '== 7. chi non ha scheda non vede nulla, senza errori =='
set test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as righe_per_bruno from get_my_workout();

\echo '== 8. la scheda di un altro non si legge =='
do $$ begin
  perform get_workout((select id from workouts where status='active' limit 1));
  raise exception 'FALLITO: letta la scheda di un altro';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 9. l allievo annota sul proprio giorno =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select day_id from get_my_workout() order by day_position limit 1 \gset
select save_workout_note(:'day_id'::uuid, 'Oggi 3 serie invece di 4, spalla dolorante.');
select day_position, note from get_my_workout() order by day_position;

\echo '== 10. e non su quello di un altro =='
set test.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform save_workout_note(
    (select id from workout_days limit 1),
    'Nota abusiva');
  raise exception 'FALLITO: nota scritta sulla scheda di un altro';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 11. il coach legge la nota dell allievo =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select day_position, title, note from get_workout(:'scheda2'::uuid) order by day_position;

\echo '== 12. modificare la scheda non butta via le note =='
select save_workout(:'scheda2'::uuid, :anna::uuid, 'Blocco forza',
  jsonb_build_array(
    jsonb_build_object('title','A rivisto','body','Panca 5x5'),
    jsonb_build_object('title','B','body','Stacco 3x5'))) is not null as risalvata;
select day_position, title, body, note from get_workout(:'scheda2'::uuid) order by day_position;

\echo '== 13. da tre giorni a due: il terzo sparisce =='
select save_workout(:'scheda'::uuid, null, 'Modello 2 giorni',
  jsonb_build_array(
    jsonb_build_object('title','A','body','x'),
    jsonb_build_object('title','B','body','y'))) is not null as ridotta;
select count(*) as giorni_rimasti from workout_days where workout_id = :'scheda'::uuid;
select status as diventata from workouts where id = :'scheda'::uuid;

\echo '== 14. i modelli non appartengono a nessuno e si duplicano =='
select id, name, status, days from list_workouts(null);
select duplicate_workout(:'scheda'::uuid, :bruno::uuid) as copia \gset
select name, status, days from list_workouts(:bruno::uuid);
select title, body from workout_days where workout_id = :'copia'::uuid order by position;

\echo '== 15. riattivare una scheda archiviata archivia quella in corso =='
select set_workout_status(:'scheda2'::uuid, 'archived');
select count(*) as attive_dopo_archiviazione
from workouts where student_id = :anna::uuid and status = 'active';
select set_workout_status(:'scheda2'::uuid, 'active');
select name, status from list_workouts(:anna::uuid);

\echo '== 16. l elenco schede e riservato ai coach =='
set test.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform list_workouts(null);
  raise exception 'FALLITO: elenco schede visibile a tutti';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== TUTTI I TEST SUPERATI =='
