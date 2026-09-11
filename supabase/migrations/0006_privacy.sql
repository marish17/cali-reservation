-- =====================================================================
-- Informativa privacy e consenso al momento della richiesta.
-- Esegui DOPO le migrazioni precedenti.
-- =====================================================================

alter table public.settings add column if not exists privacy_text       text;
alter table public.settings add column if not exists privacy_updated_at timestamptz;
alter table public.bookings add column if not exists privacy_accepted_at timestamptz;

-- Bozza di partenza. I campi fra parentesi quadre vanno compilati da
-- /admin/impostazioni: finche' restano cosi', la pagina lo segnala.
update public.settings set
  privacy_text = $txt$## Chi tratta i tuoi dati

Il titolare del trattamento è [RAGIONE SOCIALE], con sede in [INDIRIZZO COMPLETO], codice fiscale / partita IVA [CF O P.IVA], contattabile all'indirizzo arnaldo01campilongo@gmail.com.

## Quali dati raccogliamo

Per gestire la richiesta di lezione di prova raccogliamo: nome e cognome, data di nascita, indirizzo email, numero di telefono e le eventuali note che scrivi tu nel modulo.

Se il partecipante ha meno di 14 anni raccogliamo anche nome, cognome e recapito telefonico del genitore o di chi ne fa le veci.

## Perché li trattiamo

I dati servono a gestire la tua richiesta: verificare la disponibilità dell'orario, rispondere con la conferma o il rifiuto, e contattarti in caso di variazioni. La base giuridica è l'esecuzione di misure precontrattuali richieste da te (art. 6.1.b GDPR).

La data di nascita serve a verificare i requisiti di età per l'attività e a sapere se è necessaria la presenza di un accompagnatore.

Non usiamo questi dati per inviarti comunicazioni promozionali senza un tuo consenso separato.

## Minori

Se il partecipante è minorenne, la richiesta deve essere inviata da un genitore o da chi ne esercita la responsabilità, che presta il consenso per suo conto ed è presente in palestra durante la prova quando previsto.

## Per quanto tempo li conserviamo

Conserviamo i dati della richiesta per 12 mesi dalla data della prova, dopodiché vengono cancellati. Se dopo la prova inizi un percorso con noi, i dati vengono conservati secondo le regole del rapporto di associazione o del contratto.

## A chi li comunichiamo

I dati non vengono venduti né ceduti a terzi per finalità proprie. Sono trattati per nostro conto dai fornitori tecnici che rendono possibile il servizio: il fornitore dell'infrastruttura del sito, quello della banca dati e quello dell'invio delle email, tutti vincolati contrattualmente e operanti come responsabili del trattamento.

## I tuoi diritti

Puoi in ogni momento chiedere di accedere ai tuoi dati, correggerli, cancellarli, limitarne il trattamento, opporti al trattamento o riceverli in formato leggibile. Per farlo scrivi a arnaldo01campilongo@gmail.com.

Se ritieni che il trattamento violi la normativa puoi proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).

## Conferimento dei dati

Il conferimento è facoltativo, ma senza i dati richiesti non è possibile prendere in carico la prenotazione.$txt$,
  privacy_updated_at = now()
where id and privacy_text is null;

-- ---------------------------------------------------------------------
-- Testo leggibile da chiunque: l'informativa deve poterla leggere anche
-- chi non ha ancora un account, prima di decidere se darci i suoi dati.
-- ---------------------------------------------------------------------
create or replace function public.get_privacy_text()
returns table (privacy_text text, privacy_updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.privacy_text, s.privacy_updated_at from public.settings s where s.id;
$$;

revoke all on function public.get_privacy_text() from public;
grant execute on function public.get_privacy_text() to anon, authenticated;

-- ---------------------------------------------------------------------
-- La richiesta ora richiede il consenso, e ne registra il momento.
-- ---------------------------------------------------------------------
drop function if exists public.request_trial(uuid, date, text, date, text, text, text, text);

create or replace function public.request_trial(
  p_slot_id          uuid,
  p_day              date,
  p_full_name        text,
  p_birth_date       date,
  p_phone            text,
  p_privacy_accepted boolean default false,
  p_guardian_name    text default null,
  p_guardian_phone   text default null,
  p_notes            text default null
)
returns table (
  booking_id        uuid,
  cancel_token      uuid,
  day               date,
  start_time        time,
  end_time          time,
  coach_name        text,
  age               int,
  guardian_required boolean,
  status            text
)
language plpgsql security definer set search_path = public as $$
declare
  s          public.settings%rowtype;
  v_slot     record;
  v_user     uuid := auth.uid();
  v_email    text;
  v_name     text := btrim(coalesce(p_full_name, ''));
  v_phone    text := btrim(coalesce(p_phone, ''));
  v_gname    text := nullif(btrim(coalesce(p_guardian_name, '')), '');
  v_gphone   text := nullif(btrim(coalesce(p_guardian_phone, '')), '');
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
  v_age      int;
  v_needs_guardian boolean;
  v_day_n    int;
  v_slot_n   int;
  v_booking  public.bookings%rowtype;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Accedi per richiedere una prova.';
  end if;

  -- Il consenso si verifica qui, non solo nel modulo: una casella
  -- spuntata nel browser non è una prova di nulla.
  if p_privacy_accepted is not true then
    raise exception 'PRIVACY_REQUIRED'
      using hint = 'Per proseguire devi dichiarare di aver letto l''informativa privacy.';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;
  select * into s from public.settings where id;

  if length(v_name) < 2 or position(' ' in v_name) = 0 then
    raise exception 'INVALID_NAME' using hint = 'Inserisci nome e cognome.';
  end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'INVALID_PHONE' using hint = 'Inserisci un numero di telefono valido.';
  end if;
  if length(coalesce(v_notes, '')) > 500 then
    raise exception 'NOTES_TOO_LONG' using hint = 'Le note sono troppo lunghe.';
  end if;

  if p_birth_date is null then
    raise exception 'INVALID_BIRTH_DATE' using hint = 'Inserisci la data di nascita.';
  end if;
  if p_birth_date > public.app_today() or p_birth_date < public.app_today() - interval '100 years' then
    raise exception 'INVALID_BIRTH_DATE' using hint = 'La data di nascita non è valida.';
  end if;

  v_age := public.age_at(p_birth_date, p_day);

  if v_age < s.min_age then
    raise exception 'AGE_TOO_LOW'
      using hint = format('Per partecipare bisogna avere almeno %s anni.', s.min_age);
  end if;

  v_needs_guardian := v_age < s.guardian_required_under_age;

  if v_needs_guardian then
    if v_gname is null or position(' ' in v_gname) = 0 then
      raise exception 'GUARDIAN_REQUIRED'
        using hint = format(
          'Sotto i %s anni serve nome e cognome del genitore o tutore che accompagna.',
          s.guardian_required_under_age
        );
    end if;
    if v_gphone is null or length(regexp_replace(v_gphone, '[^0-9]', '', 'g')) < 8 then
      raise exception 'GUARDIAN_PHONE_REQUIRED'
        using hint = 'Inserisci un recapito telefonico del genitore o tutore.';
    end if;
  else
    v_gname  := null;
    v_gphone := null;
  end if;

  insert into public.profiles (user_id, email, full_name, birth_date, phone,
                               guardian_name, guardian_phone, updated_at)
  values (v_user, v_email, v_name, p_birth_date, v_phone, v_gname, v_gphone, now())
  on conflict (user_id) do update
    set email = excluded.email, full_name = excluded.full_name,
        birth_date = excluded.birth_date, phone = excluded.phone,
        guardian_name = excluded.guardian_name, guardian_phone = excluded.guardian_phone,
        updated_at = now();

  perform pg_advisory_xact_lock(hashtext('booking:' || p_day::text));

  select ws.id, ws.coach_id, ws.start_time, ws.end_time, ws.capacity,
         ws.weekday, c.name as coach_name
    into v_slot
  from public.weekly_slots ws
  join public.coaches c on c.id = ws.coach_id and c.active
  where ws.id = p_slot_id and ws.active;

  if not found then
    raise exception 'SLOT_NOT_FOUND' using hint = 'Questo orario non e'' piu'' disponibile.';
  end if;
  if v_slot.weekday <> extract(dow from p_day)::smallint then
    raise exception 'SLOT_WRONG_DAY' using hint = 'L''orario scelto non esiste in questa data.';
  end if;
  if exists (select 1 from public.closures cl where cl.day = p_day) then
    raise exception 'DAY_CLOSED' using hint = 'La palestra e'' chiusa in questa data.';
  end if;
  if p_day > public.app_today() + s.booking_horizon_days then
    raise exception 'TOO_FAR' using hint = 'Non e'' ancora possibile prenotare cosi'' in la'' nel tempo.';
  end if;
  if (p_day + v_slot.start_time) < public.app_now() + make_interval(hours => s.min_notice_hours) then
    raise exception 'TOO_LATE'
      using hint = format('Le prenotazioni chiudono %s ore prima dell''inizio.', s.min_notice_hours);
  end if;

  select count(*)::int into v_day_n
  from public.bookings b where b.day = p_day and public.is_active_status(b.status);

  if v_day_n >= s.max_trials_per_day then
    raise exception 'DAY_FULL' using hint = 'Le prove disponibili per questo giorno sono esaurite.';
  end if;

  select count(*)::int into v_slot_n
  from public.bookings b
  where b.slot_id = p_slot_id and b.day = p_day and public.is_active_status(b.status);

  if v_slot_n >= v_slot.capacity then
    raise exception 'SLOT_FULL' using hint = 'Questo orario e'' appena stato occupato.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.day = p_day and b.user_id = v_user and public.is_active_status(b.status)
  ) then
    raise exception 'ALREADY_BOOKED' using hint = 'Hai gia'' una richiesta attiva per questa data.';
  end if;

  insert into public.bookings (slot_id, coach_id, day, start_time, end_time,
                               full_name, birth_date, email, phone,
                               guardian_name, guardian_phone, notes,
                               user_id, status, privacy_accepted_at)
  values (p_slot_id, v_slot.coach_id, p_day, v_slot.start_time, v_slot.end_time,
          v_name, p_birth_date, v_email, v_phone, v_gname, v_gphone, v_notes,
          v_user, 'pending', now())
  returning * into v_booking;

  return query
  select v_booking.id, v_booking.cancel_token, v_booking.day,
         v_booking.start_time, v_booking.end_time, v_slot.coach_name,
         v_age, v_needs_guardian, v_booking.status;
end;
$$;

revoke all on function
  public.request_trial(uuid, date, text, date, text, boolean, text, text, text) from public;
grant execute on function
  public.request_trial(uuid, date, text, date, text, boolean, text, text, text) to authenticated;
