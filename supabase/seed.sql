-- Dati di esempio: sostituisci coach e fasce con i tuoi orari reali
-- (oppure fai tutto dal pannello /admin, e' la via consigliata).

insert into public.coaches (name) values ('Coach Marco')
on conflict do nothing;

with c as (select id from public.coaches where name = 'Coach Marco' limit 1)
insert into public.weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, v.weekday, v.start_time, v.end_time, v.capacity
from c, (values
  (1, '18:00'::time, '19:00'::time, 2),   -- lunedi'
  (1, '19:00'::time, '20:00'::time, 2),
  (3, '18:00'::time, '19:00'::time, 2),   -- mercoledi'
  (5, '18:00'::time, '19:00'::time, 2),   -- venerdi'
  (6, '10:00'::time, '11:00'::time, 3)    -- sabato
) as v(weekday, start_time, end_time, capacity)
on conflict do nothing;

-- Rendi amministratore un utente gia' creato in Authentication -> Users:
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'tua@email.it'
-- on conflict do nothing;
