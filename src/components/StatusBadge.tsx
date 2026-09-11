const LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "border-slate-500/60 text-slate-300" },
  approved: { label: "Confermata", className: "border-accent/60 text-accentSoft" },
  rejected: { label: "Non accolta", className: "border-slate-600 text-slate-500" },
  cancelled: { label: "Annullata", className: "border-slate-600 text-slate-500" },
  // "Annullata" copre sia la disdetta della persona sia quella della palestra:
  // la differenza la spiega il testo sotto la riga, dove c'è spazio.
};

export default function StatusBadge({ status }: { status: string }) {
  const entry = LABELS[status] ?? { label: status, className: "border-line text-slate-400" };
  return <span className={`badge ${entry.className}`}>{entry.label}</span>;
}
