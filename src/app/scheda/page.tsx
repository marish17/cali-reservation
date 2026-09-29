import Link from "next/link";
import MyWorkout from "@/components/MyWorkout";

export const metadata = { title: "La mia scheda" };

/**
 * La stessa scheda che si vede aprendo il sito, ma con un indirizzo
 * suo: chi allena passa la giornata dentro l'area coach e da lì deve
 * poterci arrivare senza tornare alla pagina pubblica.
 */
export default function MyWorkoutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3 text-xs text-slate-400">
        <Link href="/admin" className="hover:text-slate-200">
          ← Area coach
        </Link>
        <Link href="/" className="ml-auto hover:text-slate-200">
          Sito pubblico
        </Link>
      </div>

      <MyWorkout
        empty={
          <div className="card">
            <h1 className="text-base font-semibold text-white">Non hai una scheda</h1>
            <p className="mt-2 text-sm text-slate-300">
              Te la assegna un altro coach dalla sezione Allievi, aprendo il tuo
              nome e scrivendola come faresti per chiunque altro.
            </p>
          </div>
        }
      />
    </main>
  );
}
