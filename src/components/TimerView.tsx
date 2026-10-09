"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useTimer } from "@/lib/useTimer";
import { useWakeLock } from "@/lib/useWakeLock";
import {
  DEFAULTS,
  MODE_HINT,
  MODE_LABEL,
  formatClock,
  type Config,
  type Mode,
} from "@/lib/timer";

const STORAGE_KEY = "timer-config";
const MODES: Mode[] = ["classico", "tabata", "emom"];

export default function TimerView() {
  const [config, setConfig] = useState<Config>(DEFAULTS.tabata);
  const [loaded, setLoaded] = useState(false);

  // Le impostazioni restano su questo telefono: nessuno deve
  // reimpostare 20/10/8 ogni volta che apre l'app.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...DEFAULTS.tabata, ...(JSON.parse(raw) as Config) });
    } catch {
      // Finestra anonima o archiviazione bloccata: si parte dai valori
      // di partenza, che è esattamente quello che serve.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* vedi sopra */
    }
  }, [config, loaded]);

  const timer = useTimer(config);
  useWakeLock(timer.state === "corre");

  const { position, state } = timer;
  const kind = position.phase?.kind ?? (position.done ? "fine" : "prepara");

  const tone =
    kind === "lavoro"
      ? "text-white"
      : kind === "riposo"
        ? "text-sky-300"
        : kind === "fine"
          ? "text-emerald-300"
          : "text-slate-400";

  const ring =
    kind === "lavoro"
      ? "border-accent/60 bg-accent/10"
      : kind === "riposo"
        ? "border-sky-400/40 bg-sky-400/[0.07]"
        : kind === "fine"
          ? "border-emerald-400/50 bg-emerald-400/[0.07]"
          : "border-line bg-surface/70";

  const label =
    position.done
      ? "Finito"
      : position.phase?.kind === "prepara"
        ? "Preparati"
        : position.phase?.kind === "riposo"
          ? "Riposo"
          : "Lavora";

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-10 pt-4">
      <div className="mb-6 flex items-center gap-3 border-b border-line pb-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accentSoft">
            Timer
          </span>
        </Link>
        <Link href="/" className="ml-auto text-xs text-slate-400 hover:text-slate-200">
          ← Torna indietro
        </Link>
      </div>

      {/* Il quadrante: numeri enormi, perché si guarda da due metri e
          col fiatone. */}
      <section
        className={`rounded-2xl border p-6 text-center transition-colors ${ring}`}
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </p>

        <p className={`mt-2 font-mono text-[76px] font-bold leading-none ${tone} sm:text-[92px]`}>
          {position.done ? formatClock(0) : formatClock(position.remaining)}
        </p>

        <p className="mt-3 text-sm text-slate-400">
          {position.phase && position.phase.round > 0
            ? `Round ${position.phase.round} di ${position.phase.rounds}`
            : position.done
              ? "Allenamento completato"
              : " "}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Totale rimasto {formatClock(position.remainingTotal)}
        </p>
      </section>

      <div className="action-bar mt-5 flex gap-2">
        <button
          className="btn-ghost flex-1"
          onClick={timer.reset}
          disabled={state === "fermo"}
        >
          Azzera
        </button>
        {state === "corre" ? (
          <button className="btn-primary flex-[2]" onClick={timer.pause}>
            Pausa
          </button>
        ) : (
          <button className="btn-primary flex-[2]" onClick={timer.start}>
            {state === "pausa" ? "Riprendi" : state === "finito" ? "Di nuovo" : "Via"}
          </button>
        )}
      </div>

      <section className="card mt-5">
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              className={[
                "min-h-[44px] flex-1 rounded-xl border text-sm transition",
                config.mode === m
                  ? "border-accent/60 bg-accent/15 font-semibold text-accentSoft"
                  : "border-line text-slate-300 hover:bg-white/5",
              ].join(" ")}
              onClick={() => setConfig(DEFAULTS[m])}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-slate-500">{MODE_HINT[config.mode]}</p>

        <div className="mt-5 space-y-4">
          <Stepper
            label={config.mode === "emom" ? "Intervallo" : "Lavoro"}
            seconds={config.work}
            step={config.mode === "classico" ? 30 : 5}
            min={5}
            onChange={(work) => setConfig({ ...config, work })}
          />

          {config.mode === "tabata" && (
            <Stepper
              label="Riposo"
              seconds={config.rest}
              step={5}
              min={0}
              onChange={(rest) => setConfig({ ...config, rest })}
            />
          )}

          {config.mode !== "classico" && (
            <Stepper
              label="Round"
              seconds={config.rounds}
              step={1}
              min={1}
              plain
              onChange={(rounds) => setConfig({ ...config, rounds })}
            />
          )}

          <Stepper
            label="Preparazione"
            seconds={config.prepare}
            step={5}
            min={0}
            onChange={(prepare) => setConfig({ ...config, prepare })}
          />
        </div>

        <p className="mt-5 border-t border-line pt-3 text-xs text-slate-500">
          Durata totale {formatClock(timer.total)}. Mentre il timer corre lo
          schermo resta acceso.
        </p>
      </section>
    </main>
  );
}

/**
 * Più e meno invece di un campo da riempire: si usa in piedi, con una
 * mano, e nessuno vuole aprire la tastiera fra una serie e l'altra.
 */
function Stepper({
  label,
  seconds,
  step,
  min,
  plain = false,
  onChange,
}: {
  label: string;
  seconds: number;
  step: number;
  min: number;
  plain?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 text-sm text-slate-300">{label}</span>
      <button
        className="btn-ghost !min-h-[44px] !w-12 !px-0 text-lg"
        onClick={() => onChange(Math.max(min, seconds - step))}
        disabled={seconds <= min}
        aria-label={`Diminuisci ${label}`}
      >
        −
      </button>
      <span className="w-16 text-center font-mono text-base font-semibold tabular-nums">
        {plain ? seconds : formatClock(seconds)}
      </span>
      <button
        className="btn-ghost !min-h-[44px] !w-12 !px-0 text-lg"
        onClick={() => onChange(seconds + step)}
        aria-label={`Aumenta ${label}`}
      >
        +
      </button>
    </div>
  );
}
