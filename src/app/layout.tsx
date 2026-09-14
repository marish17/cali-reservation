import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prenota la tua prova di Calisthenics",
  description:
    "Prenota gratuitamente la tua lezione di prova di calisthenics: scegli giorno e orario.",
  // I file stanno in public/. Se mancano, il browser ricade sul
  // comportamento predefinito senza rompere nulla.
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // Serve perché "Aggiungi a Home" produca una vera icona con un nome,
  // e su iPhone è anche la condizione per ricevere gli avvisi.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Academy", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Prenota la tua prova di Calisthenics",
    description: "Scegli giorno e orario e richiedi la tua lezione di prova.",
    images: ["/icon.png"],
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
