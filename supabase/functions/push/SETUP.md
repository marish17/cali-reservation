# Attivare le notifiche push

Da fare una volta sola. Servono circa venti minuti.

Finché non è completato, il sito funziona esattamente come adesso: il
bottone per attivare le notifiche mostra "notifiche non ancora
configurate" e nient'altro si rompe.

## 1. La migrazione

SQL Editor di Supabase → esegui `supabase/migrations/0009_push_notifications.sql`.

## 2. Le chiavi

Le notifiche push si firmano con una coppia di chiavi. Generala dal
terminale, nella cartella del progetto:

```bash
npx web-push generate-vapid-keys
```

Stampa due valori: **Public Key** e **Private Key**. Tienili da parte per
i due passi successivi. La privata è un segreto: non va nel repository né
incollata in chat.

## 3. La chiave pubblica nel database

La pubblica serve al browser, quindi sta nelle impostazioni. SQL Editor,
sostituendo il valore:

```sql
update public.settings
   set vapid_public_key = 'INCOLLA_QUI_LA_PUBLIC_KEY'
 where id;
```

Sta nel database e non fra le variabili d'ambiente perché il sito è
statico: quelle si leggono solo in fase di build, e cambiarle costerebbe
una ricostruzione.

## 4. La funzione che spedisce

Serve lo strumento a riga di comando di Supabase:

```bash
npm install -g supabase
supabase login
supabase link --project-ref rkdtmscnaobdsoxoexqw
```

Poi i segreti e il deploy:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="la_public_key" \
  VAPID_PRIVATE_KEY="la_private_key" \
  VAPID_SUBJECT="mailto:tua@email.it"

supabase functions deploy push
```

`VAPID_SUBJECT` è un recapito a cui i servizi di notifica possono
scrivere in caso di problemi: basta un indirizzo email valido.

## 5. I due collegamenti

Il database deve chiamare la funzione quando succede qualcosa. Supabase →
**Database → Webhooks** → *Create a new hook*, due volte:

**Primo — nuove richieste**

| Campo | Valore |
| --- | --- |
| Name | `push_nuova_richiesta` |
| Table | `bookings` |
| Events | solo **Insert** |
| Type | Supabase Edge Functions |
| Edge Function | `push` |

**Secondo — esiti**

| Campo | Valore |
| --- | --- |
| Name | `push_esito` |
| Table | `bookings` |
| Events | solo **Update** |
| Type | Supabase Edge Functions |
| Edge Function | `push` |

Non servono altri parametri: l'autorizzazione la mette Supabase.

## 6. La prova

1. Sul telefono, apri il sito e **aggiungilo alla schermata Home**
   (su iPhone è obbligatorio: in Safari normale le push non esistono)
2. Apri l'app dalla Home, entra in `/admin` e tocca **Avvisami quando
   arriva una richiesta**
3. Da un altro dispositivo, o in una finestra in incognito, manda una
   richiesta di prova
4. Deve arrivare la notifica anche con l'app chiusa

Per l'altro verso: registrati come utente normale, attiva le notifiche da
*Le mie richieste*, e fatti approvare la prova da un coach.

## Se non arriva

**Database → Webhooks → il collegamento → Logs** mostra ogni chiamata e la
risposta. Se la chiamata parte ma la notifica non arriva, il problema è
nella funzione: `supabase functions logs push`.

Le cause più comuni sono la chiave pubblica nel database diversa da quella
usata nei segreti della funzione, e su iPhone il sito non aggiunto alla
schermata Home.
