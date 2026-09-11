/**
 * Le funzioni Postgres sollevano codici stabili (DAY_FULL, SLOT_FULL, ...)
 * con un `hint` gia' scritto in italiano per l'utente finale.
 */
const MESSAGES: Record<string, string> = {
  INVALID_NAME: "Inserisci nome e cognome.",
  INVALID_EMAIL: "Inserisci un indirizzo email valido.",
  INVALID_PHONE: "Inserisci un numero di telefono valido.",
  NOTES_TOO_LONG: "Le note sono troppo lunghe.",
  INVALID_BIRTH_DATE: "Inserisci una data di nascita valida.",
  AGE_TOO_LOW: "L'età non raggiunge il minimo richiesto per partecipare.",
  GUARDIAN_REQUIRED:
    "Serve il nome di un genitore o tutore che accompagna il partecipante.",
  GUARDIAN_PHONE_REQUIRED:
    "Serve un recapito telefonico del genitore o tutore.",
  SLOT_NOT_FOUND: "Questo orario non è più disponibile.",
  SLOT_WRONG_DAY: "L'orario scelto non esiste in questa data.",
  DAY_CLOSED: "La palestra è chiusa in questa data.",
  TOO_FAR: "Non è ancora possibile prenotare così in là nel tempo.",
  TOO_LATE: "Sei fuori tempo massimo per prenotare questo orario.",
  DAY_FULL: "Le prove disponibili per questo giorno sono esaurite.",
  SLOT_FULL: "Questo orario è appena stato occupato, scegline un altro.",
  ALREADY_BOOKED: "Risulta già una prenotazione con questa email in questa data.",
  NOT_FOUND: "Prenotazione non trovata.",
  NOT_AUTHENTICATED: "Accedi per richiedere una prova.",
  NOT_ALLOWED: "Operazione riservata ai coach.",
  USER_NOT_FOUND:
    "Nessun account con questa email. Chiedi alla persona di accedere una volta dal sito, poi riprova.",
  CANNOT_REMOVE_SELF:
    "Non puoi togliere l'accesso a te stesso. Chiedilo a un altro coach.",
  INVALID_STATUS: "Stato non valido.",
  ALREADY_CANCELLED: "La richiesta è stata annullata dall'utente.",
};

type SupabaseError = { message?: string; hint?: string | null } | null;

export function bookingErrorMessage(error: SupabaseError): string {
  if (!error) return "Si è verificato un errore imprevisto.";
  const raw = error.message ?? "";

  for (const [code, message] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  if (error.hint) return error.hint;
  if (raw.includes("bookings_one_per_email_per_day")) {
    return MESSAGES.ALREADY_BOOKED;
  }
  return "Non è stato possibile completare l'operazione. Riprova.";
}
