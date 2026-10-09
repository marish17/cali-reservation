import PageHeader from "@/components/PageHeader";
import MyWorkout from "@/components/MyWorkout";

export const metadata = { title: "La mia scheda" };

/**
 * La stessa scheda che si vede aprendo il sito, ma con un indirizzo
 * suo: chi allena passa la giornata dentro l'area coach e da lì deve
 * poterci arrivare senza tornare alla pagina pubblica.
 */
export default function MyWorkoutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10">
      <PageHeader title="La mia scheda" />

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
