import assert from "node:assert/strict";
import { parseRecipients } from "../src/lib/recipients.ts";

const casi: [string, string[], string[]][] = [
  // [valore, attesi validi, attesi rifiutati]
  ["coach@palestra.it", ["coach@palestra.it"], []],
  ["a@x.it,b@y.it,c@z.it", ["a@x.it", "b@y.it", "c@z.it"], []],
  ["a@x.it, b@y.it ,  c@z.it ", ["a@x.it", "b@y.it", "c@z.it"], []],
  ["a@x.it;b@y.it", ["a@x.it", "b@y.it"], []],
  // virgolette aggiunte per abitudine
  ['"coach@palestra.it"', ["coach@palestra.it"], []],
  ["'coach@palestra.it'", ["coach@palestra.it"], []],
  // riga intera incollata dal file .env
  ["NOTIFY_EMAIL=coach@palestra.it", ["coach@palestra.it"], []],
  // forma con nome
  ["Coach <coach@palestra.it>", ["coach@palestra.it"], []],
  // valore vuoto
  ["", [], []],
  ["  ,  ", [], []],
  // valori davvero sbagliati: vanno segnalati, non spediti
  ["non-una-email", [], ["non-una-email"]],
  ["coach@palestra", [], ["coach@palestra"]],
  ["@palestra.it", [], ["@palestra.it"]],
  // uno buono e uno rotto: il buono passa comunque
  ["buono@x.it, rotto", ["buono@x.it"], ["rotto"]],
];

let passati = 0;
for (const [input, validi, rifiutati] of casi) {
  const out = parseRecipients(input);
  try {
    assert.deepEqual(out.valid, validi);
    assert.deepEqual(out.invalid, rifiutati);
    passati++;
  } catch {
    console.log(`FALLITO  ${JSON.stringify(input)}`);
    console.log(`  atteso validi=${JSON.stringify(validi)} rifiutati=${JSON.stringify(rifiutati)}`);
    console.log(`  ottenuto validi=${JSON.stringify(out.valid)} rifiutati=${JSON.stringify(out.invalid)}`);
    process.exitCode = 1;
  }
}
console.log(`${passati}/${casi.length} casi superati`);
