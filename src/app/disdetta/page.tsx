import { Suspense } from "react";
import CancelView from "@/components/CancelView";

export const metadata = { title: "Disdici la prenotazione" };

export default function CancelPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Disdici la prenotazione</h1>
      <Suspense fallback={<div className="card">Caricamento…</div>}>
        <CancelView />
      </Suspense>
    </main>
  );
}
