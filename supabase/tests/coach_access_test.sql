-- Concessione e revoca dell'accesso al pannello.
-- Da eseguire su un database usa-e-getta dopo tutte le migrazioni.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999', 'capo@test.it'),
  ('88888888-8888-8888-8888-888888888888', 'luca@test.it'),
  ('77777777-7777-7777-7777-777777777777', 'sara@test.it'),
  ('11111111-1111-1111-1111-111111111111', 'estraneo@test.it');
insert into admins (user_id, email) values ('99999999-9999-9999-9999-999999999999', 'capo@test.it');

\echo '== 1. un utente qualunque non puo vedere gli accessi =='
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform list_admins();
  raise exception 'FALLITO: elenco accessi visibile a un estraneo';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 2. ne puo dare a se stesso? (atteso NOT_ALLOWED) =='
do $$ begin
  perform grant_admin('estraneo@test.it');
  raise exception 'FALLITO: un estraneo si e autopromosso';
exception when others then
  if sqlerrm like '%NOT_ALLOWED%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 3. il coach concede l accesso a Luca =='
set test.uid = '99999999-9999-9999-9999-999999999999';
select ga.admin_email from grant_admin('LUCA@test.it') ga;

\echo '== 4. email senza account -> atteso USER_NOT_FOUND =='
do $$ begin
  perform grant_admin('mainvista@test.it');
  raise exception 'FALLITO: accesso dato a un account inesistente';
exception when others then
  if sqlerrm like '%USER_NOT_FOUND%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 5. email scritta male -> atteso INVALID_EMAIL =='
do $$ begin
  perform grant_admin('non-una-email');
  raise exception 'FALLITO: email non valida accettata';
exception when others then
  if sqlerrm like '%INVALID_EMAIL%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 6. concedere due volte non duplica =='
select ga.admin_email from grant_admin('luca@test.it') ga;
select count(*) as accessi_totali from admins;

\echo '== 7. ora Luca vede il pannello e puo aggiungere Sara =='
set test.uid = '88888888-8888-8888-8888-888888888888';
select is_admin() as luca_e_coach;
select ga.admin_email from grant_admin('sara@test.it') ga;

\echo '== 8. elenco accessi (attesi 3, con is_me su Luca) =='
select la.admin_email, la.is_me from list_admins() la;

\echo '== 9. non si puo revocare a se stessi =='
do $$ begin
  perform revoke_admin('88888888-8888-8888-8888-888888888888');
  raise exception 'FALLITO: revoca a se stessi riuscita';
exception when others then
  if sqlerrm like '%CANNOT_REMOVE_SELF%' then raise notice 'OK: %', sqlerrm; else raise; end if;
end $$;

\echo '== 10. Luca revoca Sara =='
select r.removed is not null as revocata from revoke_admin('77777777-7777-7777-7777-777777777777') r;
select count(*) as accessi_rimasti from admins;

\echo '== 11. Sara non e piu coach =='
set test.uid = '77777777-7777-7777-7777-777777777777';
select is_admin() as sara_e_ancora_coach;

\echo '== TUTTI I TEST SUPERATI =='
