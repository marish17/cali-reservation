import { formatDayLong, formatTime } from "@/lib/date";

export type RequestNotification = {
  full_name: string;
  age: number;
  day: string;
  start_time: string;
  end_time: string;
  email: string;
  phone: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  adminUrl: string;
};

export type DecisionNotification = {
  to: string;
  full_name: string;
  day: string;
  start_time: string;
  end_time: string;
  approved: boolean;
  note: string | null;
};

export type SendResult =
  | { ok: true }
  | { ok: false; reason: string; detail?: string };

/** Destinatari degli avvisi: uno o piu' indirizzi separati da virgola. */
export function notifyRecipients(): string[] {
  return (process.env.NOTIFY_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 16px 6px 0;color:#71717a;font-size:13px;white-space:nowrap">${label}</td>
    <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600">${escapeHtml(value)}</td>
  </tr>`;
}

function shell(kicker: string, title: string, inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:14px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#e01e2b">${kicker}</p>
    <h1 style="margin:0 0 20px;font-size:20px;color:#18181b">${escapeHtml(title)}</h1>
    ${inner}
  </div>
</div>`;
}

/**
 * Un invio fallito non deve mai far fallire l'operazione in corso:
 * l'esito torna a chi chiama, che decide se ignorarlo o mostrarlo.
 */
async function send(payload: Record<string, unknown>): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY non è impostata." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM ?? "Prenotazioni <onboarding@resend.dev>",
        ...payload,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Email non inviata:", response.status, detail);
      return { ok: false, reason: `Il servizio email ha risposto ${response.status}.`, detail };
    }
    return { ok: true };
  } catch (error) {
    console.error("Email non inviata:", error);
    return { ok: false, reason: "Non è stato possibile contattare il servizio email.", detail: String(error) };
  }
}

/** Avvisa i coach che c'e' una richiesta da approvare. */
export async function notifyNewRequest(b: RequestNotification): Promise<SendResult> {
  const to = notifyRecipients();
  if (to.length === 0) {
    return { ok: false, reason: "NOTIFY_EMAIL non è impostata: nessun destinatario." };
  }

  const rows = [
    row("Partecipante", b.full_name),
    row("Età", `${b.age} anni`),
    row("Quando", `${formatDayLong(b.day)}, ${formatTime(b.start_time)}–${formatTime(b.end_time)}`),
    row("Email", b.email),
    row("Telefono", b.phone),
  ];
  if (b.guardian_name) {
    rows.push(row("Accompagnato da", `${b.guardian_name} — ${b.guardian_phone ?? ""}`));
  }
  if (b.notes) rows.push(row("Note", b.notes));

  const inner = `<table style="border-collapse:collapse;width:100%">${rows.join("")}</table>
    ${
      b.guardian_name
        ? `<p style="margin:20px 0 0;padding:12px;border-radius:10px;background:#fef2f2;color:#7f1d1d;font-size:13px">
             Minore: il giorno della prova deve presentarsi accompagnato dal genitore o tutore indicato.
           </p>`
        : ""
    }
    <p style="margin:24px 0 0">
      <a href="${b.adminUrl}" style="display:inline-block;background:#e01e2b;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600">
        Approva o rifiuta
      </a>
    </p>`;

  return send({
    to,
    reply_to: b.email,
    subject: `Richiesta di prova: ${b.full_name} — ${formatDayLong(b.day)} ${formatTime(b.start_time)}`,
    html: shell("Nuova richiesta", `${b.full_name} chiede una prova`, inner),
    text: [
      `Nuova richiesta di prova: ${b.full_name} (${b.age} anni)`,
      `${formatDayLong(b.day)}, ${formatTime(b.start_time)}-${formatTime(b.end_time)}`,
      `Email: ${b.email}`,
      `Telefono: ${b.phone}`,
      b.guardian_name ? `Accompagnato da: ${b.guardian_name} (${b.guardian_phone ?? "-"})` : "",
      b.notes ? `Note: ${b.notes}` : "",
      `Approva o rifiuta: ${b.adminUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

/** Comunica all'utente l'esito della sua richiesta. */
export async function notifyDecision(d: DecisionNotification): Promise<SendResult> {
  const when = `${formatDayLong(d.day)}, ${formatTime(d.start_time)}–${formatTime(d.end_time)}`;

  const inner = `<table style="border-collapse:collapse;width:100%">
      ${row("Quando", when)}
    </table>
    ${
      d.note
        ? `<p style="margin:20px 0 0;padding:12px;border-radius:10px;background:#f4f4f5;color:#3f3f46;font-size:14px">
             ${escapeHtml(d.note)}
           </p>`
        : ""
    }
    <p style="margin:20px 0 0;color:#52525b;font-size:13px">
      ${
        d.approved
          ? "Ti aspettiamo: presentati qualche minuto prima con abbigliamento sportivo."
          : "Puoi scegliere un altro giorno dalla pagina delle prenotazioni."
      }
    </p>`;

  return send({
    to: [d.to],
    subject: d.approved
      ? `Prova confermata — ${formatDayLong(d.day)} ${formatTime(d.start_time)}`
      : `Richiesta non accolta — ${formatDayLong(d.day)} ${formatTime(d.start_time)}`,
    html: shell(
      d.approved ? "Prova confermata" : "Richiesta non accolta",
      d.approved
        ? `${d.full_name}, la tua prova è confermata`
        : `${d.full_name}, non possiamo accogliere questa data`,
      inner
    ),
    text: [
      d.approved ? "La tua prova è confermata." : "La tua richiesta non è stata accolta.",
      when,
      d.note ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
