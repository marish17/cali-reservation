"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

/**
 * L'intestazione, uguale su tutte le pagine.
 *
 * Prima ogni pagina si faceva la sua: una col logo, una con «← torna
 * indietro», una con due collegamenti ai lati. Cambiando sezione la
 * cima dello schermo si riorganizzava ogni volta, e questo basta a
 * far sembrare un'app un insieme di pagine separate.
 *
 * Il ritorno indietro non c'è: da quando esiste la barra in basso, è
 * lei la strada, e un secondo pulsante per lo stesso gesto occupa
 * spazio senza aggiungere niente.
 */
export default function PageHeader({
  title,
  actions,
}: {
  title: string;
  /** Solo quello che riguarda questa pagina. */
  actions?: React.ReactNode;
}) {
  return (
    <div className="app-header mb-6 sm:mb-8">
      <div className="flex items-center gap-3 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Vai alla pagina iniziale">
          <Logo size={32} />
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold sm:text-base">{title}</h1>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
