/**
 * Il testo è scritto dal coach nel pannello, non dagli utenti: qui
 * serve solo dare una forma leggibile a titoli e paragrafi, senza
 * tirare dentro un interprete markdown completo.
 */
export default function PrivacyText({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) =>
        block.startsWith("## ") ? (
          <h2 key={index} className="pt-3 text-base font-semibold text-white">
            {block.slice(3)}
          </h2>
        ) : (
          <p key={index} className="text-sm leading-relaxed text-slate-300">
            {block}
          </p>
        )
      )}
    </div>
  );
}
