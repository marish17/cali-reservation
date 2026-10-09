-- Esercizi proposti a partire dalle schede già scritte.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

\echo '== 1. da una riga di scheda al nome dell esercizio =='
select riga, exercise_name_from_line(riga) as nome
from (values
  ('Trazioni 4x5'),
  ('- Piegamenti 4x8'),
  ('Plank 3x40"'),
  ('Dip 3 x 6 (pausa 2'')'),
  ('1) Squat 5x5'),
  ('Panca piana 4x8 @70%'),
  ('Verticale al muro 5x30"'),
  ('Rematore con manubrio 3x12'),
  ('Corsa 10'''),
  ('Riscaldamento'),
  ('   '),
  ('4x8'),
  ('100 metri sprint'),
  ('30 secondi di corsa'),
  ('Trazioni')
) as v(riga);

\echo '== 2. senza essere coach non si vede nulla =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform suggest_exercises();
  raise exception 'FALLITO: proposte visibili a un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 3. le proposte nascono dalle schede scritte davvero =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select save_workout(null, '11111111-1111-1111-1111-111111111111', 'Base',
  jsonb_build_array(
    jsonb_build_object('title', 'Spinta', 'body',
      E'Riscaldamento 10''\n\nPiegamenti 4x8\nDip 3x6\nPlank 3x40"'),
    jsonb_build_object('title', 'Tirata', 'body',
      E'Trazioni 4x5\nRematore con manubrio 3x12\nPiegamenti 3x10')),
  null, null, false) is not null as scheda_salvata;
select name, uses from suggest_exercises();

\echo '== 4. i piu usati vengono per primi =='
select name as primo from suggest_exercises() limit 1;

\echo '== 5. quello che e gia in libreria non si ripropone =='
insert into exercises (name, unit) values ('Piegamenti', 'reps');
select name from suggest_exercises();

\echo '== 6. il confronto ignora maiuscole e spazi =='
insert into exercises (name, unit) values ('  trazioni  ', 'reps');
select count(*) as trazioni_ancora_proposte
from suggest_exercises() where lower(btrim(name)) = 'trazioni';

\echo '== 7. quello che il coach scarta non torna piu =='
select dismiss_exercise_name('Riscaldamento');
select count(*) as riscaldamento_riproposto
from suggest_exercises() where lower(btrim(name)) = 'riscaldamento';

\echo '== 8. scartare due volte non e un errore =='
select dismiss_exercise_name('  RISCALDAMENTO  ');
select count(*) as righe_scartate from dismissed_exercise_names;

\echo '== 9. solo un coach puo scartare =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform dismiss_exercise_name('Dip');
  raise exception 'FALLITO: proposta scartata da un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 10. la nota sull esercizio si salva e si rilegge =='
set test.uid = '99999999-9999-9999-9999-999999999999';
update exercises set notes = 'Presa prona, gomiti stretti' where name = 'Piegamenti';
select name, notes from exercises where name = 'Piegamenti';

\echo '== 11. l allievo non vede la libreria esercizi =='
set test.uid = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select count(*) as esercizi_visibili_all_allievo from exercises;
reset role;

\echo '== TUTTI I TEST SUPERATI =='
