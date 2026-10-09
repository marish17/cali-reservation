/**
 * Il timer di allenamento, come dati puri: nessun React, nessun suono.
 *
 * Il tempo si legge dall'orologio, non contando i battiti. Un telefono
 * che mette la pagina in secondo piano rallenta i timer del browser:
 * chi conta i battiti perde secondi e se ne accorge solo a fine serie.
 */

export type Mode = "classico" | "tabata" | "emom";

export type PhaseKind = "prepara" | "lavoro" | "riposo";

export type Phase = {
  kind: PhaseKind;
  seconds: number;
  /** Da 1 in su; 0 per la preparazione, che non è un round. */
  round: number;
  rounds: number;
};

export type Config = {
  mode: Mode;
  /** Secondi di conto alla rovescia prima di partire. */
  prepare: number;
  /** Durata del lavoro. Per EMOM è la lunghezza dell'intervallo. */
  work: number;
  rest: number;
  rounds: number;
};

export const DEFAULTS: Record<Mode, Config> = {
  classico: { mode: "classico", prepare: 10, work: 300, rest: 0, rounds: 1 },
  tabata: { mode: "tabata", prepare: 10, work: 20, rest: 10, rounds: 8 },
  emom: { mode: "emom", prepare: 10, work: 60, rest: 0, rounds: 10 },
};

export const MODE_LABEL: Record<Mode, string> = {
  classico: "Classico",
  tabata: "Tabata",
  emom: "EMOM",
};

export const MODE_HINT: Record<Mode, string> = {
  classico: "Un conto alla rovescia e basta.",
  tabata: "Lavoro e riposo che si alternano, per il numero di round scelto.",
  emom: "Un round all'inizio di ogni intervallo: quello che avanza è riposo.",
};

/** La successione delle fasi, dall'inizio alla fine. */
export function buildPhases(config: Config): Phase[] {
  const phases: Phase[] = [];
  const rounds = Math.max(1, config.rounds);

  if (config.prepare > 0) {
    phases.push({ kind: "prepara", seconds: config.prepare, round: 0, rounds });
  }

  for (let round = 1; round <= rounds; round++) {
    phases.push({ kind: "lavoro", seconds: config.work, round, rounds });

    // Il riposo dopo l'ultimo round non serve a niente: si finisce
    // sul lavoro, che è anche più soddisfacente da guardare.
    if (config.mode === "tabata" && config.rest > 0 && round < rounds) {
      phases.push({ kind: "riposo", seconds: config.rest, round, rounds });
    }
  }

  return phases;
}

export function totalSeconds(phases: Phase[]): number {
  return phases.reduce((sum, p) => sum + p.seconds, 0);
}

export type Position = {
  /** Indice della fase in corso, o -1 quando è tutto finito. */
  index: number;
  phase: Phase | null;
  /** Secondi che restano nella fase, arrotondati per eccesso. */
  remaining: number;
  /** Secondi che restano in tutto. */
  remainingTotal: number;
  done: boolean;
};

/** Dove siamo, dopo `elapsed` secondi dall'inizio. */
export function positionAt(phases: Phase[], elapsed: number): Position {
  const total = totalSeconds(phases);
  const t = Math.max(0, elapsed);

  let start = 0;
  for (let i = 0; i < phases.length; i++) {
    const end = start + phases[i].seconds;
    if (t < end) {
      return {
        index: i,
        phase: phases[i],
        remaining: Math.max(0, Math.ceil(end - t)),
        remainingTotal: Math.max(0, Math.ceil(total - t)),
        done: false,
      };
    }
    start = end;
  }

  return { index: -1, phase: null, remaining: 0, remainingTotal: 0, done: true };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
