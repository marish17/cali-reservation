export type NavItem = { href: string; label: string };

/** Le sezioni dell'area coach, in un posto solo. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Prenotazioni" },
  { href: "/admin/allievi", label: "Allievi" },
  { href: "/admin/orari", label: "Coach e orari" },
  { href: "/admin/chiusure", label: "Chiusure" },
  { href: "/admin/esercizi", label: "Esercizi" },
  { href: "/timer", label: "Timer" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
  { href: "/admin/accessi", label: "Accessi" },
];

/**
 * Il sito è esportato con la barra finale negli indirizzi, quindi
 * `/admin/` e `/admin` sono lo stesso posto. Confrontarli così com'è
 * lascia la voce spenta: era il motivo per cui «Prenotazioni» non si
 * illuminava mai.
 */
export function samePath(a: string, b: string): boolean {
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  return trim(a) === trim(b);
}

/** Vero anche per le pagine sotto, non solo per quella esatta. */
export function underPath(pathname: string, href: string): boolean {
  if (samePath(pathname, href)) return true;
  const base = href.length > 1 ? href.replace(/\/+$/, "") : href;
  return pathname.startsWith(`${base}/`);
}
