import MyBookings from "@/components/MyBookings";

export const metadata = { title: "Le mie richieste" };

export default function MyBookingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
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
