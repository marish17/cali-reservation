/**
 * Le domande del questionario vivono qui, non in colonne del database:
 * riformularne una e' una modifica da cinque minuti, e le risposte gia'
 * raccolte restano valide perche' sono salvate per chiave.
 *
 * Non rinominare una `id` gia' usata: le risposte vecchie resterebbero
 * orfane. Per cambiare una domanda si cambia solo la `label`.
 */

export type IntakeQuestion = {
  id: string;
  label: string;
  hint?: string;
  /** Domande sulla salute: richiedono il consenso esplicito. */
  health?: boolean;
} & (
  | { type: "single"; options: string[] }
  | { type: "multi"; options: string[] }
  | { type: "text"; placeholder?: string }
  | { type: "long"; placeholder?: string }
);

export type IntakeSection = {
  title: string;
  /** Mostrato sotto il titolo della sezione. */
  note?: string;
  questions: IntakeQuestion[];
};

export const INTAKE: IntakeSection[] = [
  {
    title: "Da dove parte",
    questions: [
      {
        id: "esperienza",
        label: "Da quanto si allena",
        type: "single",
        options: [
          "Mai allenato",
          "Meno di 6 mesi",
          "Da 6 mesi a 2 anni",
          "Più di 2 anni",
        ],
      },
      {
        id: "sport_passati",
        label: "Sport praticati in passato",
        type: "text",
        placeholder: "Nuoto, calcio, palestra…",
      },
      {
        id: "frequenza",
        label: "Quanti giorni a settimana può allenarsi",
        hint: "Decide se la scheda sarà a 2 o a 3 giorni.",
        type: "single",
        options: ["2 giorni", "3 giorni", "Più di 3"],
      },
    ],
  },
  {
    title: "Dove vuole arrivare",
    questions: [
      {
        id: "obiettivi",
        label: "Obiettivi",
        hint: "Se ne possono scegliere più di uno.",
        type: "multi",
        options: [
          "Forza",
          "Prima trazione",
          "Verticale",
          "Dimagrire",
          "Massa muscolare",
          "Mobilità",
          "Rimettersi in forma",
          "Preparazione a uno sport",
        ],
      },
      {
        id: "obiettivo_principale",
        label: "Se ne dovesse scegliere uno solo",
        type: "text",
        placeholder: "Con parole sue",
      },
    ],
  },
  {
    title: "Salute",
    note: "Sono dati sanitari: si raccolgono solo con il consenso della persona, spuntato qui sotto.",
    questions: [
      {
        id: "condizioni",
        label: "Condizioni da tenere presenti",
        health: true,
        type: "multi",
        options: [
          "Schiena",
          "Spalle",
          "Ginocchia",
          "Polsi o gomiti",
          "Pressione",
          "Cuore",
          "Asma",
          "Diabete",
          "Gravidanza o post parto",
        ],
      },
      {
        id: "infortuni",
        label: "Infortuni o interventi",
        hint: "Anche vecchi, se ancora danno fastidio.",
        health: true,
        type: "long",
        placeholder: "Quando, cosa, com'è andata…",
      },
      {
        id: "terapie",
        label: "Terapie o farmaci in corso",
        health: true,
        type: "long",
        placeholder: "Solo se rilevante per l'allenamento",
      },
      {
        id: "dolore_oggi",
        label: "Qualcosa che fa male adesso",
        health: true,
        type: "text",
        placeholder: "Es. spalla destra in alzata",
      },
    ],
  },
  {
    title: "Note del coach",
    questions: [
      {
        id: "note_coach",
        label: "Cosa hai visto durante la prova",
        hint: "Le legge solo chi allena.",
        type: "long",
        placeholder: "Mobilità di spalla scarsa, scapole poco attive…",
      },
    ],
  },
];

/** Tutte le domande in fila, per leggere una risposta senza cercarla. */
export const INTAKE_QUESTIONS: IntakeQuestion[] = INTAKE.flatMap((s) => s.questions);

/** Il questionario tocca dati sanitari solo se qualcuna di queste ha risposta. */
export function touchesHealth(answers: Record<string, unknown>): boolean {
  return INTAKE_QUESTIONS.some((q) => {
    if (!q.health) return false;
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "";
  });
}
