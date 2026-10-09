import PageHeader from "@/components/PageHeader";
import MyBookings from "@/components/MyBookings";

export const metadata = { title: "Le mie richieste" };

export default function MyBookingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10">
      <PageHeader title="Le mie richieste" />

      <p className="text-sm text-slate-400">
        Lo stato di ogni prova richiesta si aggiorna qui. Quando il coach risponde, il
        numero delle novità compare in alto accanto a <strong>Le mie richieste</strong>. Da
        qui puoi anche annullare una prova che non ti serve più.
      </p>
      <div className="mt-6">
        <MyBookings />
      </div>
    </main>
  );
}
