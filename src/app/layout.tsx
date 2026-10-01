import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Il nome sulla linguetta è quello della palestra, non quello di una
  // sola cosa che ci si fa: lo legge anche chi si allena da tre anni e
  // una prova non la prenota più.
  // Le pagine interne aggiungono il loro nome senza perdere quello
  // della palestra: «La mia scheda · Calisthenics Academy».
  title: {
    default: "Calisthenics Academy",
    template: "%s · Calisthenics Academy",
  },
  description:
    "La tua scheda, gli orari del tuo coach e la prenotazione della prova gratuita.",
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
  // L'anteprima del link invece la vede chi arriva da fuori: lì la
  // prova gratuita è il motivo per cui dovrebbe toccarlo.
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
