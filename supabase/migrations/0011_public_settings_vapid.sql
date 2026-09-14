-- =====================================================================
-- La chiave pubblica delle notifiche deve arrivare al browser.
-- 0009 l'ha aggiunta alle impostazioni ma non a ciò che il sito legge,
-- quindi il bottone "Avvisami" restava disabilitato senza spiegazione.
-- Esegui DOPO 0009_push_notifications.sql.
-- =====================================================================

drop function if exists public.get_public_settings();

create or replace function public.get_public_settings()
returns table (
  gym_name                    text,
  intro_text                  text,
  booking_horizon_days        int,
  min_notice_hours            int,
  max_trials_per_day          int,
  min_age                     int,
  guardian_required_under_age int,
  contact_email               text,
  contact_phone               text,
  vapid_public_key            text
)
language sql stable security definer set search_path = public as $$
  select s.gym_name, s.intro_text, s.booking_horizon_days, s.min_notice_hours,
         s.max_trials_per_day, s.min_age, s.guardian_required_under_age,
         s.contact_email, s.contact_phone, s.vapid_public_key
  from public.settings s where s.id;
$$;

revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated;
