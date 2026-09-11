# Prenotazione prove — Calisthenics

Web app pubblica per prenotare la lezione di prova: l'utente sceglie giorno e
orario tra quelli in cui il coach è effettivamente presente, con un tetto
massimo di prove per giornata. Nessun account richiesto per chi prenota;
coach e orari si gestiscono da un pannello riservato.

- **Stack**: Next.js 14 (App Router, TypeScript, Tailwind) + Supabase (Postgres, Auth, RLS)
- **Pagine pubbliche**: `/` prenotazione, `/disdetta?token=…` disdetta self-service
- **Area riservata**: `/admin` (prenotazioni, coach e orari, chiusure, impostazioni)

## Come funzionano i limiti

Le regole vivono nel database, non nel browser: anche chi chiamasse l'API a
mano non può aggirarle.

| Regola | Dove si imposta |
| --- | --- |
| Prove massime per giornata | `/admin/impostazioni` → *Prove max al giorno* |
| Posti per singola fascia oraria | `/admin/orari` → colonna *posti* della fascia |
| Presenza del coach | `/admin/orari` → fasce ricorrenti per giorno della settimana |
| Chiusure e festività | `/admin/chiusure` |
| Quanto in anticipo si può prenotare | `/admin/impostazioni` → *Giorni prenotabili in anticipo* |
| Preavviso minimo prima dell'inizio | `/admin/impostazioni` → *Preavviso minimo (ore)* |

In più, il database impedisce due prove attive con la stessa email nello stesso
giorno, e le prenotazioni concorrenti sullo stesso giorno vengono serializzate
con un lock: il tetto giornaliero non può essere superato da due richieste
simultanee.

Tutte le date e gli orari sono trattati come orario locale `Europe/Rome`.

## Setup

### 1. Database Supabase

Crea un progetto su [supabase.com](https://supabase.com), apri **SQL Editor** e
incolla per intero il contenuto di `supabase/migrations/0001_init.sql`.
Crea tabelle, policy di sicurezza e le funzioni di prenotazione.

Facoltativo: `supabase/seed.sql` inserisce un coach e alcune fasce di esempio.

### 2. Utente amministratore

In Supabase → **Authentication → Users → Add user**, crea l'utente con email e
password (spunta *Auto Confirm User*). Poi, nel SQL Editor:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'tua@email.it';
```

Solo gli utenti presenti in `admins` possono entrare in `/admin`.

### 3. Variabili d'ambiente

Copia `.env.example` in `.env.local` e incolla i valori da Supabase →
**Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

La chiave `anon` è pensata per stare nel browser: le policy RLS e le funzioni
`security definer` sono ciò che protegge i dati. **Non** inserire mai qui la
chiave `service_role`.

### 4. Avvio

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Importa il repository su [Vercel](https://vercel.com), imposta le due variabili
`NEXT_PUBLIC_…` e pubblica. Nessun'altra configurazione necessaria.

## Test delle regole di prenotazione

`supabase/tests/booking_rules_test.sql` verifica capienza, tetto giornaliero,
disdetta, chiusure, orizzonte, preavviso e doppie prenotazioni. Va eseguito su
un database Postgres usa-e-getta (non sul progetto di produzione), dopo aver
applicato la migrazione:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/tests/booking_rules_test.sql
```

Su un Postgres locale servono prima gli stub di Supabase (schema `auth`,
funzione `auth.uid()`, ruoli `anon` e `authenticated`).

## Struttura

```
src/app/            pagine (pubbliche + /admin)
src/components/     flusso di prenotazione, disdetta, guscio admin
src/lib/            client Supabase, formattazione date, messaggi di errore
supabase/           migrazione, seed e test delle regole
```

## Passi successivi possibili

- Email automatica di conferma e promemoria (Supabase Edge Function + Resend)
- Rate limit per IP sulle prenotazioni anonime
- Export CSV delle prenotazioni
