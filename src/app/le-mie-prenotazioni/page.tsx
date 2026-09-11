import Link from "next/link";
import MyBookings from "@/components/MyBookings";

export const metadata = { title: "Le mie richieste" };

export default function MyBookingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 border-b border-line pb-3">
        <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
          ← Torna alle prenotazioni
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Le mie richieste</h1>
      <p className="mt-2 text-sm text-slate-400">
        Qui vedi lo stato di ogni prova richiesta e puoi annullarla se non ti serve più.
      </p>
      <div className="mt-6">
        <MyBookings />
      </div>
    </main>
  );
}
