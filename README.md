# Prenotazione prove — Calisthenics

Web app pubblica per prenotare la lezione di prova: l'utente sceglie giorno e
orario tra quelli in cui il coach è effettivamente presente, con un tetto
massimo di prove per giornata. Chi prenota si registra con email e password e
invia una **richiesta**: la prova è confermata solo quando il coach la approva.
Coach, orari e approvazioni si gestiscono da un pannello riservato.

**L'app non invia email.** L'indirizzo serve solo come nome utente e resta nel
database. Gli avvisi arrivano per altre due strade:

- **Dentro il sito**: un contatore accanto a *Le mie richieste* per chi prenota,
  uno sulle richieste da evadere per il coach.
- **Notifiche push**, anche ad app chiusa, per chi le attiva. Vanno configurate
  una volta sola seguendo `supabase/functions/push/SETUP.md`; finché non lo
  sono, il resto funziona identico.

Su iPhone le push arrivano solo se il sito è stato aggiunto alla schermata Home:
la pagina principale lo spiega a chi non l'ha fatto.

- **Stack**: Next.js 14 in esportazione statica (App Router, TypeScript, Tailwind) + Supabase (Postgres, Auth, RLS)
- **Pagine pubbliche**: `/` prenotazione, `/le-mie-prenotazioni` stato delle proprie richieste, `/privacy` informativa

Il sito è un pacchetto di file statici: non c'è nessun processo acceso a
generarli, e ogni dato arriva da Supabase direttamente dal browser. Le regole
di accesso vivono tutte nel database (policy RLS e funzioni `security
definer`), quindi non serve un server intermedio a farle rispettare.
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
2. Per proseguire crea un account con email e password
3. Compila nome, data di nascita e telefono, e accetta l'informativa privacy —
   la volta dopo i dati sono già precompilati, il consenso no: si ridà ogni volta
4. La richiesta nasce **in attesa** e tiene occupato il posto
5. Il coach la vede nel pannello, col contatore delle richieste da evadere, e
   conferma o rifiuta con un messaggio facoltativo
6. Rientrando nel sito, la persona trova il numero delle novità accanto a
   *Le mie richieste* e lì l'esito, evidenziato

Una prova già confermata può essere annullata dal coach in caso di imprevisto,
con un motivo facoltativo: il posto torna subito libero. Resta distinguibile da
una disdetta della persona, perché registra chi ha deciso. Senza email, per un
imprevisto a ridosso conviene telefonare: il pannello mostra il numero.

Il coach può attivare gli **avvisi del browser** dal pannello, per accorgersi di
una nuova richiesta senza tenere la pagina sott'occhio.

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
7. `supabase/migrations/0007_coach_cancel.sql` — annullamento di una prova da parte del coach
8. `supabase/migrations/0008_in_app_notifications.sql` — notifiche dentro l'app
9. `supabase/migrations/0009_push_notifications.sql` — notifiche push

Per sapere quali risultano già applicate:
`supabase/checks/verifica_migrazioni.sql` risponde con un elenco leggibile e
non modifica nulla.

Ogni file va eseguito in una query separata.

**Attenzione**: la terza migrazione cancella le prenotazioni esistenti. Erano
state fatte senza account e non c'è modo di ricondurle a un utente.

### 1b. Registrazione senza email

Supabase → **Authentication → Sign In / Providers → Email**: disattiva
**Confirm email**.

È il passaggio che rende il sito utilizzabile senza un servizio di posta: con
la conferma attiva, ogni registrazione resta in sospeso in attesa di un
messaggio che non verrà mai inviato.

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

### 4. Avvio

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy su Netlify

Il repository contiene già `netlify.toml` e `.nvmrc`. La build produce la
cartella `out/`, che Netlify serve così com'è: nessuna funzione serverless,
quindi nessuna invocazione da pagare.

1. Netlify → **Add new site → Import an existing project** → scegli il repository
2. Build command e publish directory arrivano da `netlify.toml`: non toccarli
3. **Site configuration → Environment variables**: aggiungi le due voci
   `NEXT_PUBLIC_…`

**Le variabili vengono incorporate durante la build**, non lette mentre il sito
gira: dopo averle cambiate serve un nuovo deploy, salvarle non basta.

Per pubblicare a comando invece che a ogni push — utile quando i crediti di
build scarseggiano — metti **Build status: Stopped builds** nelle impostazioni
di deploy. I push non fanno più partire nulla; quando vuoi pubblicare rimetti
*Active builds* e lancia **Deploys → Trigger deploy**.

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
- `supabase/tests/coach_cancel_test.sql` — annullamento da parte del coach, posto
  liberato, doppio annullamento, chi può annullare
- `supabase/tests/notifications_test.sql` — conteggio delle novità per l'utente,
  coda delle richieste per il coach, presa visione, separazione fra utenti
- `supabase/tests/push_test.sql` — registrazione dei dispositivi, destinatari di
  ogni evento, isolamento fra utenti, recapiti scaduti
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

- Promemoria il giorno prima della prova
- Export CSV delle prenotazioni
- Email, se un giorno servirà: va configurato un SMTP in Supabase per i
  messaggi di autenticazione, e da lì si può riattivare anche l'invio degli
  esiti
