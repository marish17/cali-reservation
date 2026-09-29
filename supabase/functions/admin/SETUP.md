# Funzione `admin` — reimpostare una password, cancellare un account

Due operazioni che il pannello non può fare da solo, perché richiedono la
chiave di servizio di Supabase: quella che può toccare qualunque account.
Nel browser sarebbe leggibile da chiunque apra gli strumenti di sviluppo,
quindi sta qui.

## Deploy

Dalla cartella del progetto, con la CLI già collegata (è la stessa con cui
hai fatto il deploy di `push`):

```bash
supabase functions deploy admin
```

**Senza `--no-verify-jwt`**, al contrario di `push`. Quella la chiama il
database con una parola d'ordine condivisa; questa la chiama una persona,
e vogliamo che Supabase verifichi il suo token prima ancora che il codice
parta.

Segreti da aggiungere: **nessuno**. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` sono già a disposizione di ogni funzione.

## Cosa fa, e cosa si rifiuta di fare

| Regola | Perché |
|---|---|
| Chi chiama dev'essere nella tabella `admins` | altrimenti chiunque abbia un account potrebbe resettare password altrui |
| Non funziona su sé stessi | la propria password si cambia dal profilo; cancellarsi l'account da qui è solo un modo di chiudersi fuori |
| **Non funziona su un altro coach** | senza questo limite uno dei tre può prendersi l'accesso completo di un collega, e nessuno se ne accorge |
| Ogni reset finisce in `password_resets` | chi, per chi, quando. Un potere del genere senza traccia non si lascia a nessuno |

Se un coach dimentica la propria password, gliela cambi dalla dashboard di
Supabase: **Authentication → Users → la riga → Reset password**. Siete in
tre, succederà di rado.

## La password provvisoria

Viene fuori come `vela-cardo-7231`: due parole e quattro cifre. Sono parole
invece di caratteri a caso perché questa password va detta a voce o scritta
in un messaggio, e `x7Kp!2q` costringe a chiedere tre volte se è una elle o
una i maiuscola.

Finché la persona non se la cambia, **quella password la conosce anche il
coach**: l'app glielo ricorda con un avviso in cima, che sparisce da solo
appena la cambia dal proprio profilo.

## La regola che il codice non può imporre

Verificare **chi** sta chiedendo il reset è un lavoro tuo, non del software.
Se ti arriva un messaggio da un numero che non conosci che dice «sono Marco,
resettami la password», nessun controllo qui dentro può fermarti.
