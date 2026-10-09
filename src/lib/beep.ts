"use client";

/**
 * I segnali acustici del timer.
 *
 * Niente file audio: due oscillatori bastano e non c'è niente da
 * scaricare. iOS non lascia suonare nulla finché l'utente non ha
 * toccato qualcosa, quindi il contesto audio si apre al primo tocco
 * sul pulsante di avvio e poi resta aperto.
 */

let ctx: AudioContext | null = null;

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const w = window as WindowWithWebkitAudio;
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Da chiamare dentro un tocco dell'utente, prima di suonare. */
export function unlockAudio(): void {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

function tone(frequency: number, duration: number, delay = 0, volume = 0.22): void {
  const c = context();
  if (!c || c.state !== "running") return;

  const at = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, at);

  // Attacco e rilascio morbidi: un'onda tagliata di netto fa un
  // "clack" fastidioso a volume alto.
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Tre, due, uno: nota breve e bassa. */
export function beepCountdown(): void {
  tone(880, 0.12);
}

/** Si parte, o cambia fase: nota lunga e alta. */
export function beepGo(): void {
  tone(1320, 0.3, 0, 0.26);
}

/** Si riposa: due note che scendono. */
export function beepRest(): void {
  tone(660, 0.16);
  tone(440, 0.22, 0.16);
}

/** Finito: tre note che salgono. */
export function beepFinish(): void {
  tone(660, 0.16);
  tone(880, 0.16, 0.17);
  tone(1320, 0.4, 0.34, 0.26);
}
