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

Serve lo strumento a riga di comando di Supabase (su Mac:
`brew install supabase/tap/supabase`, altrimenti anteponi `npx` a ogni
comando):

```bash
supabase login
supabase link --project-ref IL_TUO_PROJECT_REF
```

Poi i segreti. `PUSH_SECRET` è una parola d'ordine che inventi tu: serve
solo perché il database e la funzione si riconoscano fra loro.

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="la_public_key" \
  VAPID_PRIVATE_KEY="la_private_key" \
  VAPID_SUBJECT="mailto:tua@email.it" \
  PUSH_SECRET="una_parola_lunga_a_caso"
```

E la pubblicazione:

```bash
supabase functions deploy push --no-verify-jwt
```

`--no-verify-jwt` serve perché a chiamarla è il database, che non ha una
sessione utente. Al suo posto la funzione controlla la parola d'ordine, e
l'unico potere che quella dà è far partire una notifica per una
prenotazione che esiste già.

## 5. Dire al database dove chiamare

Esegui `supabase/migrations/0010_push_triggers.sql`, poi, sostituendo i
due valori:

```sql
insert into public.private_config (key, value) values
  ('push_function_url', 'https://IL_TUO_PROJECT_REF.supabase.co/functions/v1/push'),
  ('push_secret',       'la_stessa_parola_del_passo_4')
on conflict (key) do update set value = excluded.value;
```

L'indirizzo lo trovi anche in **Edge Functions → push**, voce *URL*.

Questa tabella non è leggibile né dal pubblico né dagli utenti
autenticati: ci arrivano solo le funzioni interne del database.

Da qui in poi il database chiama la funzione da solo a ogni nuova
richiesta e a ogni esito. Non servono i Database Webhooks.

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

`supabase functions logs push` mostra ogni chiamata ricevuta e cosa è
successo. Se non compare nessuna chiamata, il database non sta chiamando:
controlla che `private_config` contenga le due righe e che l'indirizzo sia
quello giusto.

```sql
select key, left(value, 40) from public.private_config;
```

Un `403` nei log significa che la parola d'ordine nel database e quella
nei segreti della funzione non coincidono.

Le altre cause comuni sono la chiave pubblica nel database diversa da
quella usata nei segreti, e su iPhone il sito non aggiunto alla schermata
Home.
