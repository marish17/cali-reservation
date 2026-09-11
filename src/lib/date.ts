export const WEEKDAYS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

/** "2026-09-11" -> "Ven 11 set" */
export function formatDayShort(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString("it-IT", {
    month: "short",
  })}`;
}

/** "2026-09-11" -> "Venerdì 11 settembre" */
export function formatDayLong(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString("it-IT", {
    month: "long",
  })}`;
}

/** "18:00:00" -> "18:00" */
export function formatTime(value: string): string {
  return value.slice(0, 5);
}

/** Parsing esplicito: `new Date("2026-09-11")` sarebbe UTC, non locale. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
