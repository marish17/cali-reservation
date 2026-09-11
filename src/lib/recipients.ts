const EMAIL_RE = /^[^@\s<>",]+@[^@\s<>",]+\.[A-Za-z]{2,}$/;

/**
 * Ripulisce un valore scritto a mano in un pannello: virgolette che
 * l'utente ha aggiunto per abitudine, spazi, un eventuale "Nome <...>",
 * e un "CHIAVE=" incollato per intero insieme al valore.
 */
function cleanAddress(raw: string): string {
  let value = raw.trim();
  value = value.replace(/^[A-Z_][A-Z0-9_]*\s*=\s*/i, "");
  value = value.replace(/^["']|["']$/g, "").trim();
  const angled = value.match(/<([^>]+)>\s*$/);
  if (angled) value = angled[1].trim();
  return value;
}

export type Recipients = { valid: string[]; invalid: string[] };

/**
 * Destinatari degli avvisi: uno o piu' indirizzi separati da virgola
 * (o punto e virgola, che è l'altro separatore che la gente usa).
 * Un indirizzo malformato non deve far saltare l'invio agli altri.
 */
export function parseRecipients(raw = process.env.NOTIFY_EMAIL ?? ""): Recipients {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const part of raw.split(/[,;]/)) {
    if (!part.trim()) continue;
    const address = cleanAddress(part);
    if (EMAIL_RE.test(address)) valid.push(address);
    else invalid.push(part.trim());
  }

  return { valid, invalid };
}

export function notifyRecipients(): string[] {
  return parseRecipients().valid;
}
