import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prenota la tua prova di Calisthenics",
  description:
    "Prenota gratuitamente la tua lezione di prova di calisthenics: scegli giorno, orario e coach.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
