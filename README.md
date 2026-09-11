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
| Età minima per partecipare | `/admin/impostazioni` → *Età minima* |
| Soglia sotto cui serve un accompagnatore | `/admin/impostazioni` → *Accompagnatore obbligatorio sotto i* |
| Posti per singola fascia oraria | `/admin/orari` → colonna *posti* della fascia |
| Presenza del coach | `/admin/orari` → fasce ricorrenti per giorno della settimana |
| Chiusure e festività | `/admin/chiusure` |
| Quanto in anticipo si può prenotare | `/admin/impostazioni` → *Giorni prenotabili in anticipo* |
| Preavviso minimo prima dell'inizio | `/admin/impostazioni` → *Preavviso minimo (ore)* |

In più, il database impedisce due prove attive con la stessa email nello stesso
giorno, e le prenotazioni concorrenti sullo stesso giorno vengono serializzate
con un lock: il tetto giornaliero non può essere superato da due richieste
simultanee.

### Età e accompagnatore

Al posto dell'età si chiede la **data di nascita**: un numero digitato a mano
invecchia, una data no, e permette di calcolare gli anni compiuti *il giorno
della prova* (chi li compie il giorno stesso è già maggiorenne per la regola,
chi li compie il giorno dopo no).

Sotto la soglia configurata (default 14 anni) il form chiede nome e telefono
del genitore o tutore, che compaiono poi nel pannello e nell'email al coach.
Sopra la soglia quei dati non vengono conservati, anche se inviati.

Tutte le date e gli orari sono trattati come orario locale `Europe/Rome`.

## Setup

### 1. Database Supabase

Crea un progetto su [supabase.com](https://supabase.com), apri **SQL Editor** e
incolla per intero, **in ordine**:

1. `supabase/migrations/0001_init.sql` — tabelle, policy di sicurezza, logica di prenotazione
2. `supabase/migrations/0002_age_and_guardian.sql` — data di nascita, età minima, accompagnatore

Ogni file va eseguito in una query separata.

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

### 3b. Notifiche via email (facoltativo)

A ogni nuova prenotazione parte un'email al coach con nome, età, giorno, orario
e contatti (e i dati dell'accompagnatore, se minore). Per attivarla:

1. Registrati su [resend.com](https://resend.com) (piano gratuito: 100 email al giorno)
2. **API Keys** → crea una chiave
3. Aggiungi a `.env.local`:

```
RESEND_API_KEY=re_...
NOTIFY_EMAIL=coach@tuapalestra.it
NOTIFY_FROM=Prenotazioni <onboarding@resend.dev>
```

`NOTIFY_EMAIL` accetta più indirizzi separati da virgola. `NOTIFY_FROM` può
restare `onboarding@resend.dev` per iniziare; per spedire dal tuo dominio va
prima verificato su Resend.

Senza queste variabili l'app funziona identica, solo senza email. Se Resend
fosse irraggiungibile la prenotazione viene comunque registrata: l'errore
finisce nei log, non sulla faccia del cliente.

La prenotazione passa da una route server (`/api/book`), quindi l'email parte
anche se l'utente chiude la pagina subito dopo l'invio, e la chiave di Resend
non arriva mai al browser.

### 4. Avvio

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Importa il repository su [Vercel](https://vercel.com) e riporta nelle
*Environment Variables* le stesse voci di `.env.local` (le due `NEXT_PUBLIC_…`
sono obbligatorie, le tre di Resend solo se vuoi le email). Poi pubblica.

## Test delle regole di prenotazione

Due suite, da eseguire su un database Postgres usa-e-getta (**non** sul
progetto di produzione), ognuna su un database pulito:

- `supabase/tests/booking_rules_test.sql` — capienza, tetto giornaliero,
  disdetta, chiusure, orizzonte, preavviso, doppie prenotazioni
- `supabase/tests/age_rules_test.sql` — età minima, soglia accompagnatore,
  calcolo dell'età al giorno della prova, date di nascita non valide

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_age_and_guardian.sql
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

- Email di conferma anche al cliente, e promemoria il giorno prima
- Rate limit per IP sulle prenotazioni anonime
- Export CSV delle prenotazioni
