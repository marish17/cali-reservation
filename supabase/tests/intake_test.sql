-- Allievi, questionario e valutazioni.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');

insert into exercises (name, unit) values ('Trazioni', 'reps'), ('Plank', 'seconds');

\echo '== 1. senza essere coach non si compila il questionario di nessuno =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform save_intake('22222222-2222-2222-2222-222222222222', '{"obiettivi":"forza"}'::jsonb, true);
  raise exception 'FALLITO: questionario salvato da un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. nemmeno sul proprio: il questionario lo compila il coach durante la prova =='
do $$ begin
  perform save_intake('11111111-1111-1111-1111-111111111111', '{"obiettivi":"forza"}'::jsonb, true);
  raise exception 'FALLITO: questionario compilato dall allievo stesso';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 3. il coach compila: nasce l allievo e resta traccia di chi ha scritto =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select save_intake(
  '11111111-1111-1111-1111-111111111111',
  '{"obiettivi":["forza","mobilita"],"patologie":"nessuna","sport_passati":"nuoto"}'::jsonb,
  true);
select coach_id is null as senza_coach,
       health_consent_at is not null as consenso_salute,
       intake_updated_at is not null as compilato,
       intake_filled_by = '99999999-9999-9999-9999-999999999999' as compilato_dal_coach
from students where user_id = '11111111-1111-1111-1111-111111111111';
select count(*) as risposte from intake_answers where user_id = '11111111-1111-1111-1111-111111111111';

\echo '== 4. il questionario e una fotografia intera: le chiavi tolte spariscono =='
select save_intake(
  '11111111-1111-1111-1111-111111111111',
  '{"obiettivi":["forza"],"patologie":"asma"}'::jsonb,
  true);
select question_id, value from get_intake('11111111-1111-1111-1111-111111111111') order by question_id;

\echo '== 5. un consenso dato non si ritira per distrazione =='
select health_consent_at as prima from students where user_id = '11111111-1111-1111-1111-111111111111' \gset
select save_intake('11111111-1111-1111-1111-111111111111', '{"patologie":"asma"}'::jsonb, false);
select health_consent_at = :'prima' as consenso_invariato
from students where user_id = '11111111-1111-1111-1111-111111111111';

\echo '== 6. risposte non valide rifiutate =='
do $$ begin
  perform save_intake('11111111-1111-1111-1111-111111111111', '"testo"'::jsonb, true);
  raise exception 'FALLITO: risposte non-oggetto accettate';
exception when others then
  if sqlerrm like '%INVALID_ANSWERS%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 7. l allievo legge il proprio questionario, non quello degli altri =='
set test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as righe_mie from get_intake('11111111-1111-1111-1111-111111111111');
do $$ begin
  perform get_intake('22222222-2222-2222-2222-222222222222');
  raise exception 'FALLITO: letto il questionario di un altro';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 8. una valutazione senza esercizi non ha senso =='
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform save_assessment('11111111-1111-1111-1111-111111111111', app_today(), '[]'::jsonb);
  raise exception 'FALLITO: valutazione vuota accettata';
exception when others then
  if sqlerrm like '%NO_ITEMS%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 9. due valutazioni a distanza: si rileggono dalla piu recente =='
select save_assessment(
  '11111111-1111-1111-1111-111111111111', app_today() - 90,
  jsonb_build_array(
    jsonb_build_object('exercise_id', (select id from exercises where name='Trazioni'), 'value', 6, 'unit', 'reps'),
    jsonb_build_object('exercise_id', (select id from exercises where name='Plank'), 'value', 40, 'unit', 'seconds')),
  'Punto di partenza') is not null as prima_salvata;
select save_assessment(
  '11111111-1111-1111-1111-111111111111', app_today(),
  jsonb_build_array(
    jsonb_build_object('exercise_id', (select id from exercises where name='Trazioni'), 'value', 9, 'unit', 'reps')),
  null) is not null as seconda_salvata;
select day, exercise_name, value, unit, notes from get_assessments('11111111-1111-1111-1111-111111111111');

\echo '== 10. le valutazioni di un non-coach: solo le proprie =='
set test.uid = '22222222-2222-2222-2222-222222222222';
do $$ begin
  perform get_assessments('11111111-1111-1111-1111-111111111111');
  raise exception 'FALLITO: lette le valutazioni di un altro';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
do $$ begin
  perform save_assessment('22222222-2222-2222-2222-222222222222', app_today(),
    jsonb_build_array(jsonb_build_object(
      'exercise_id', (select id from exercises where name='Trazioni'), 'value', 3, 'unit', 'reps')));
  raise exception 'FALLITO: valutazione salvata da un non-coach';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 11. l elenco persone e riservato ai coach =='
do $$ begin
  perform list_people();
  raise exception 'FALLITO: elenco persone visibile a tutti';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;
set test.uid = '99999999-9999-9999-9999-999999999999';
select email, is_student, intake_updated_at is not null as ha_questionario from list_people() order by email;

\echo '== 12. la libreria esercizi non accetta doppioni scritti diversi =='
do $$ begin
  insert into exercises (name) values ('  trazioni ');
  raise exception 'FALLITO: esercizio duplicato accettato';
exception when unique_violation then raise notice 'OK: doppione rifiutato';
end $$;

\echo '== 13. un esercizio usato in una valutazione non si cancella per sbaglio =='
do $$ begin
  delete from exercises where name = 'Trazioni';
  raise exception 'FALLITO: esercizio cancellato con valutazioni collegate';
exception when foreign_key_violation then raise notice 'OK: cancellazione bloccata';
end $$;

\echo '== 14. assegnare un allievo a un coach =='
insert into coaches (name) values ('Marco');
update students set coach_id = (select id from coaches where name='Marco')
 where user_id = '11111111-1111-1111-1111-111111111111';
select p.email, c.name as coach from list_people() p
  join coaches c on c.id = p.coach_id;

\echo '== TUTTI I TEST SUPERATI =='
