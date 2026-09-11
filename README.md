# Prenotazione prove — Calisthenics

Web app pubblica per prenotare la lezione di prova: l'utente sceglie giorno e
orario tra quelli in cui il coach è effettivamente presente, con un tetto
massimo di prove per giornata. Chi prenota accede con un link via email e
invia una **richiesta**: la prova è confermata solo quando il coach la
approva, e l'esito arriva per email. Coach, orari e approvazioni si
gestiscono da un pannello riservato.

- **Stack**: Next.js 14 (App Router, TypeScript, Tailwind) + Supabase (Postgres, Auth, RLS)
- **Pagine pubbliche**: `/` prenotazione, `/le-mie-prenotazioni` stato delle proprie richieste, `/privacy` informativa
- **Area riservata**: `/admin` (approvazioni, coach e orari, chiusure, impostazioni, accessi)

## Privacy

Il modulo raccoglie dati personali, inclusi quelli di minori e dei loro
genitori, quindi chiede un consenso esplicito con collegamento all'informativa,
e registra il momento in cui è stato dato. Il consenso è verificato dal
database, non solo dalla casella nel browser.

Il testo dell'informativa si scrive da `/admin/impostazioni` e compare su
`/privacy`. La migrazione ne installa una **bozza**: i punti fra parentesi
quadre (ragione sociale, sede, contatti, tempi di conservazione) vanno
compilati, e il pannello li elenca finché restano aperti.

La bozza copre i punti richiesti dall'art. 13 GDPR, ma **non è un parere
legale**: prima di aprire al pubblico fatela leggere a chi segue la privacy
della vostra associazione, soprattutto per la parte sui minori e sui tempi di
conservazione.

## Il giro completo

1. Il visitatore sceglie giorno e orario dal calendario
2. Per proseguire accede con un link via email (niente password)
3. Compila nome, data di nascita e telefono, e accetta l'informativa privacy —
   la volta dopo i dati sono già precompilati, il consenso no: si ridà ogni volta
4. La richiesta nasce **in attesa** e tiene occupato il posto
5. Il coach riceve una email e da `/admin` conferma o rifiuta, con un messaggio facoltativo
6. L'utente riceve l'esito via email e lo rivede in `/le-mie-prenotazioni`

Un rifiuto libera subito il posto. L'utente può annullare da solo una richiesta
finché la prova non è passata.

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
3. `supabase/migrations/0003_accounts_and_approval.sql` — account, richieste in attesa, approvazione
4. `supabase/migrations/0004_gym_name.sql` — nome della palestra
5. `supabase/migrations/0005_coach_access.sql` — gestione degli accessi dal pannello
6. `supabase/migrations/0006_privacy.sql` — informativa privacy e consenso

Per sapere quali risultano già applicate:
`supabase/checks/verifica_migrazioni.sql` risponde con un elenco leggibile e
non modifica nulla.

Ogni file va eseguito in una query separata.

**Attenzione**: la terza migrazione cancella le prenotazioni esistenti. Erano
state fatte senza account e non c'è modo di ricondurle a un utente.

### 1b. Accesso con link via email

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` in sviluppo, l'indirizzo del sito una
  volta pubblicato
- **Redirect URLs**: aggiungi entrambi, `http://localhost:3000/**` e
  `https://tuo-sito.vercel.app/**`

Senza questi due valori il link ricevuto per email non riporta all'app.

Facoltativo: `supabase/seed.sql` inserisce un coach e alcune fasce di esempio.

### 2. Utente amministratore

In Supabase → **Authentication → Users → Add user**, crea l'utente con email e
password (spunta *Auto Confirm User*). Poi, nel SQL Editor:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'tua@email.it';
```

Solo gli utenti presenti in `admins` possono entrare in `/admin`. Questa query
serve **una volta sola**, per il primo coach: da lì in poi gli altri accessi si
danno da `/admin/accessi`, senza toccare SQL.

### Aggiungere gli altri coach

1. La persona apre il sito e accede almeno una volta col link via email (basta
   iniziare una prenotazione). Serve perché il suo account esista e l'indirizzo
   risulti verificato: così non si può dare accesso a una casella sbagliata.
2. Un coach già abilitato va su `/admin/accessi`, inserisce quell'email e
   conferma.

Accesso al pannello e presenza in palestra restano due cose distinte: perché gli
orari di un coach compaiano nel calendario va aggiunto anche in
`/admin/orari`.

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

### 3b. Email (facoltativo)

Due email automatiche: una al coach a ogni nuova richiesta (nome, età, giorno,
orario, contatti, accompagnatore se minore) e una all'utente quando il coach
decide, col messaggio che il coach ha eventualmente scritto. Per attivarle:

1. Registrati su [resend.com](https://resend.com) (piano gratuito: 100 email al giorno)
2. **API Keys** → crea una chiave
3. Aggiungi a `.env.local`:

```
RESEND_API_KEY=re_...
NOTIFY_EMAIL=coach@tuapalestra.it
NOTIFY_FROM=Prenotazioni <onboarding@resend.dev>
```

`NOTIFY_EMAIL` accetta più indirizzi separati da virgola: per avvisare tutti i
coach basta elencarli.

```
NOTIFY_EMAIL=marco@tuapalestra.it,luca@tuapalestra.it,sara@tuapalestra.it
```

`NOTIFY_FROM` è la trappola più comune: Resend spedisce **solo** da un dominio
che hai verificato tu. Mettere lì il tuo indirizzo personale (Gmail, iCloud,
Outlook…) fa fallire ogni invio, silenziosamente per l'utente e con un errore
nei log. Finché non hai verificato un dominio, lascia esattamente
`onboarding@resend.dev`.

Sempre con `onboarding@resend.dev`, Resend consegna **solo** all'indirizzo con
cui ti sei registrato. È la ragione per cui, in questa configurazione, l'avviso
al coach arriva e quello di esito alla persona che ha prenotato no: il primo va
al tuo indirizzo, il secondo a un indirizzo qualunque. Per far partire anche
quello serve verificare un dominio su Resend e usarlo in `NOTIFY_FROM`.

Finché non è verificato, il pannello avvisa il coach quando un'email di esito
non è partita, indicando l'indirizzo della persona da contattare a mano.

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

## Deploy su Netlify

Il repository contiene già `netlify.toml` e `.nvmrc`: Netlify usa il runtime
Next.js, necessario perché le route server (`/api/request`, `/api/decide`)
funzionino. Un deploy statico non basta.

1. Netlify → **Add new site → Import an existing project** → scegli il repository
2. Build command e publish directory arrivano da `netlify.toml`: non toccarli
3. **Site configuration → Environment variables**: aggiungi le stesse voci di
   `.env.local`. Le due `NEXT_PUBLIC_…` sono obbligatorie; le tre dell'email
   solo se vuoi le notifiche
4. Fai il deploy e segnati l'indirizzo assegnato (es. `nome-sito.netlify.app`)

### Dopo il primo deploy, obbligatorio

Supabase → **Authentication → URL Configuration**:

- **Site URL**: l'indirizzo del sito pubblicato
- **Redirect URLs**: aggiungi `https://nome-sito.netlify.app/**`, tenendo anche
  `http://localhost:3000/**` per lo sviluppo

Senza questo passaggio il link di accesso inviato per email non riporta al sito
e **nessuno riesce a prenotare**. È l'errore più facile da fare pubblicando.

Le variabili d'ambiente si leggono al momento della build: dopo averle
cambiate serve un nuovo deploy, non basta salvarle.

### Lo scanner dei segreti

Netlify fa fallire la build se il valore di una variabile compare nei file
prodotti. Per `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`NOTIFY_FROM` è normale che compaia, ed è per questo che `netlify.toml` le
esclude tramite `SECRETS_SCAN_OMIT_KEYS`. I due valori `NEXT_PUBLIC_…` devono
raggiungere il browser per funzionare: a proteggere i dati sono le policy RLS,
non la loro segretezza.

`RESEND_API_KEY` è volutamente esclusa da quell'elenco: quella è un segreto
vero, e se finisse nei file della build è giusto che la build si fermi.

## Test delle regole di prenotazione

Due suite, da eseguire su un database Postgres usa-e-getta (**non** sul
progetto di produzione), ognuna su un database pulito:

- `supabase/tests/booking_rules_test.sql` — capienza, tetto giornaliero,
  disdetta, chiusure, orizzonte, preavviso, doppie prenotazioni
- `supabase/tests/age_rules_test.sql` — età minima, soglia accompagnatore,
  calcolo dell'età al giorno della prova, date di nascita non valide
- `supabase/tests/approval_rules_test.sql` — account obbligatorio, posto tenuto
  dalle richieste in attesa, approvazione e rifiuto, chi può decidere, annullamento
- `supabase/tests/coach_access_test.sql` — chi può concedere e revocare l'accesso
  al pannello, email senza account, revoca a se stessi
- `supabase/tests/privacy_test.sql` — richiesta rifiutata senza consenso, momento
  del consenso registrato, informativa leggibile da chiunque ma modificabile solo dai coach
- `supabase/tests/security_test.sql` — chi può leggere e scrivere cosa: verifica
  che un visitatore non veda nessun dato personale, che un utente registrato veda
  soltanto i propri, e che non possa scrivere direttamente nelle tabelle

L'ultimo va eseguito dopo aver concesso ai ruoli di prova gli stessi privilegi
che Supabase assegna di default, altrimenti passerebbe per il motivo sbagliato:

```sql
grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant select on auth.users to anon, authenticated;
```

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_age_and_guardian.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_accounts_and_approval.sql
psql "$DATABASE_URL" -f supabase/tests/approval_rules_test.sql
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

- Promemoria automatico il giorno prima della prova
- Rate limit per IP sulle prenotazioni anonime
- Export CSV delle prenotazioni
