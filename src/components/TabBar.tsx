"use client";

import { useEffect } from "react";
import Link from "next/link";

export type Tab = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Una voce porta altrove, oppure apre qualcosa qui. */
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
};

/**
 * La barra di navigazione in basso, solo su telefono.
 *
 * Sta in fondo perché lì arriva il pollice: in cima, su uno schermo da
 * sei pollici, una mano sola non ci arriva. Sopra il computer sparisce,
 * dove il menu laterale è già sempre aperto e una barra sarebbe solo
 * una seconda strada per gli stessi posti.
 */
export default function TabBar({ tabs }: { tabs: Tab[] }) {
  // Il corpo della pagina deve lasciare spazio sotto, e i pulsanti
  // ancorati in fondo devono salire sopra la barra. Lo spazio lo
  // dichiara la barra stessa, così non c'è una pagina che se ne scorda.
  useEffect(() => {
    document.body.classList.add("has-tabbar");
    return () => document.body.classList.remove("has-tabbar");
  }, []);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Navigazione principale"
    >
      <ul className="mx-auto flex h-14 max-w-lg">
        {tabs.map((tab) => {
          const content = (
            <>
              <span className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1 min-w-[16px] rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-white">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </>
          );

          const className = [
            "flex h-full w-full flex-col items-center justify-center gap-1 transition active:scale-[0.94]",
            tab.active ? "text-accentSoft" : "text-slate-400",
          ].join(" ");

          return (
            <li key={tab.key} className="flex-1">
              {tab.href ? (
                <Link href={tab.href} className={className} aria-current={tab.active ? "page" : undefined}>
                  {content}
                </Link>
              ) : (
                <button type="button" className={className} onClick={tab.onClick}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* Icone disegnate a mano: una libreria intera per sei simboli
   peserebbe più di tutto il resto della barra. */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconSheet = (
  <Icon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Icon>
);

export const IconCalendar = (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const IconClock = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const IconPerson = (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
  </Icon>
);

export const IconPeople = (
  <Icon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" />
    <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2.1.7 3.5 2.4 3.5 5.2" />
  </Icon>
);

export const IconMore = (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
