-- Avviso all'allievo quando la scheda è pronta o cambia.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@test.it'),
  ('22222222-2222-2222-2222-222222222222', 'bruno@test.it'),
  ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'coach@test.it');
insert into coaches (name) values ('Marco');

-- Senza questi la funzione non spedisce e non registra niente.
insert into private_config (key, value) values
  ('push_function_url', 'https://esempio.test/push'),
  ('push_secret', 'segreto')
on conflict (key) do update set value = excluded.value;

-- I recapiti dei telefoni: senza, non c'è nessuno da avvisare.
set test.uid = '11111111-1111-1111-1111-111111111111';
select save_push_subscription('https://push.test/anna', 'chiave-anna', 'auth-anna');
set test.uid = '22222222-2222-2222-2222-222222222222';
select save_push_subscription('https://push.test/bruno', 'chiave-bruno', 'auth-bruno');

\set anna '''11111111-1111-1111-1111-111111111111'''

\echo '== 1. assegnare una scheda avvisa l allievo =='
set test.uid = '99999999-9999-9999-9999-999999999999';
truncate net.calls;
select save_workout(null, :anna::uuid, 'Base 3 giorni',
  '[{"title":"A","body":"x"},{"title":"B","body":"y"}]'::jsonb,
  null, (select id from coaches where name='Marco')) as scheda \gset
select body ->> 'audience' as avviso from net.calls;

\echo '== 2. il testo dice che e pronta, e chi la manda =='
select title, body, url from push_targets(:'scheda'::uuid, 'student_new');

\echo '== 3. modificarla avvisa che e cambiata, non che e nuova =='
truncate net.calls;
select save_workout(:'scheda'::uuid, :anna::uuid, 'Base 3 giorni',
  '[{"title":"A rivisto","body":"x2"},{"title":"B","body":"y"}]'::jsonb) is not null as risalvata;
select body ->> 'audience' as avviso from net.calls;
select title from push_targets(:'scheda'::uuid, 'student_update');

\echo '== 4. correggere un refuso senza avvisare nessuno =='
truncate net.calls;
select save_workout(:'scheda'::uuid, :anna::uuid, 'Base 3 giorni',
  '[{"title":"A","body":"x3"},{"title":"B","body":"y"}]'::jsonb,
  null, null, false) is not null as corretta;
select count(*) as avvisi_partiti from net.calls;

\echo '== 5. un modello non e di nessuno: nessun avviso =='
truncate net.calls;
select save_workout(null, null, 'Modello',
  '[{"title":"A","body":"x"},{"title":"B","body":"y"}]'::jsonb) is not null as modello;
select count(*) as avvisi_partiti from net.calls;

\echo '== 6. assegnarne una nuova avvisa una volta sola, non anche per quella archiviata =='
truncate net.calls;
select save_workout(null, :anna::uuid, 'Blocco forza',
  '[{"title":"A","body":"x"},{"title":"B","body":"y"}]'::jsonb) as scheda2 \gset
select count(*) as avvisi_partiti, min(body ->> 'audience') as avviso from net.calls;

\echo '== 7. la scheda archiviata non ha destinatari: si segue quella in corso =='
select count(*) as destinatari_archiviata from push_targets(:'scheda'::uuid, 'student_update');
select count(*) as destinatari_in_corso   from push_targets(:'scheda2'::uuid, 'student_update');

\echo '== 8. riprendere una vecchia scheda avvisa, archiviarla no =='
truncate net.calls;
select set_workout_status(:'scheda2'::uuid, 'archived');
select count(*) as avvisi_archiviando from net.calls;
select set_workout_status(:'scheda2'::uuid, 'active');
select count(*) as avvisi_riprendendo from net.calls;

\echo '== 9. l avviso va solo all allievo della scheda, non a tutti =='
select count(*) as destinatari from push_targets(:'scheda2'::uuid, 'student_new');
select endpoint from push_targets(:'scheda2'::uuid, 'student_new');

\echo '== 10. le notifiche delle prenotazioni continuano a funzionare =='
insert into weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select id, w, '18:00', '19:00', 5 from coaches, generate_series(0,6) w;
set test.uid = '22222222-2222-2222-2222-222222222222';
truncate net.calls;
select 1 from request_trial(
  (select ga.slot_id from get_availability(app_today()+2, app_today()+2) ga limit 1),
  app_today()+2, 'Bruno Verdi', (app_today() - interval '30 years')::date, '3331112223', true);
select body ->> 'audience' as avviso from net.calls;

\echo '== 11. il vecchio nome continua a rispondere, per la funzione non ancora ripubblicata =='
select title from push_targets_for_booking(:'scheda2'::uuid, 'student_update');

\echo '== TUTTI I TEST SUPERATI =='
