"use client";

import { useState } from "react";

/**
 * Il file del logo lo aggiunge chi gestisce il sito (public/icon.png).
 * Finche' non c'e', il marchio semplicemente non compare: meglio del
 * riquadro con l'icona rotta che mostrerebbe il browser.
 */
export default function Logo({ size = 32 }: { size?: number }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain"
        onError={() => setMissing(true)}
      />
    </span>
  );
}
