-- Orari di partenza: lunedì, mercoledì e venerdì dalle 18 alle 21,
-- divisi in tre fasce da un'ora con 2 posti ciascuna.
--
-- Da incollare nel SQL Editor di Supabase dopo le migrazioni.
-- Tutto quello che c'è qui si può poi cambiare da /admin/orari.

insert into public.coaches (name) values ('Coach')
on conflict do nothing;

with c as (select id from public.coaches where name = 'Coach' limit 1)
insert into public.weekly_slots (coach_id, weekday, start_time, end_time, capacity)
select c.id, v.weekday, v.start_time, v.end_time, 2
from c, (values
  -- weekday: 1 = lunedì, 3 = mercoledì, 5 = venerdì
  (1, '18:00'::time, '19:00'::time),
  (1, '19:00'::time, '20:00'::time),
  (1, '20:00'::time, '21:00'::time),
  (3, '18:00'::time, '19:00'::time),
  (3, '19:00'::time, '20:00'::time),
  (3, '20:00'::time, '21:00'::time),
  (5, '18:00'::time, '19:00'::time),
  (5, '19:00'::time, '20:00'::time),
  (5, '20:00'::time, '21:00'::time)
) as v(weekday, start_time, end_time)
on conflict do nothing;

-- Variante: una sola fascia aperta 18-21 invece di tre da un'ora.
-- Cancella le tre righe del giorno e inseriscine una sola, per esempio:
--
--   insert into public.weekly_slots (coach_id, weekday, start_time, end_time, capacity)
--   select id, 1, '18:00', '21:00', 3 from public.coaches where name = 'Coach';

-- Rendi amministratore un utente già creato in Authentication -> Users:
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'tua@email.it'
-- on conflict do nothing;
