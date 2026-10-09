"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { beepCountdown, beepFinish, beepGo, beepRest, unlockAudio } from "@/lib/beep";
import { buildPhases, positionAt, totalSeconds, type Config, type Position } from "@/lib/timer";

type State = "fermo" | "corre" | "pausa" | "finito";

/**
 * Fa correre il timer e suona al momento giusto.
 *
 * Il tempo trascorso si calcola dall'orologio a ogni giro, non
 * sommando i battiti: se il telefono mette la pagina in secondo piano
 * e rallenta i timer, al ritorno i secondi sono comunque quelli veri.
 */
export function useTimer(config: Config) {
  const [state, setState] = useState<State>("fermo");
  const [elapsed, setElapsed] = useState(0);

  // Istante di partenza e tempo già accumulato prima dell'ultima pausa.
  const startedAt = useRef(0);
  const offset = useRef(0);
  const lastBeep = useRef<string>("");
  const lastPhase = useRef(-2);

  const phases = buildPhases(config);
  const total = totalSeconds(phases);
  const position: Position = positionAt(phases, elapsed);

  // Cambiando impostazioni si riparte da zero: lasciare i secondi
  // vecchi su una successione nuova mostrerebbe numeri senza senso.
  useEffect(() => {
    setState("fermo");
    setElapsed(0);
    offset.current = 0;
    lastBeep.current = "";
    lastPhase.current = -2;
  }, [config.mode, config.prepare, config.work, config.rest, config.rounds]);

  useEffect(() => {
    if (state !== "corre") return;

    let frame = 0;
    const tick = () => {
      setElapsed(offset.current + (Date.now() - startedAt.current) / 1000);
      frame = window.setTimeout(tick, 100);
    };
    tick();
    return () => window.clearTimeout(frame);
  }, [state]);

  // I suoni: uno per ogni cambio di fase, e tre prima della fine.
  useEffect(() => {
    if (state !== "corre") return;

    if (position.done) {
      if (lastBeep.current !== "fine") {
        lastBeep.current = "fine";
        beepFinish();
      }
      setState("finito");
      return;
    }

    if (position.index !== lastPhase.current) {
      lastPhase.current = position.index;
      if (position.phase?.kind === "lavoro") beepGo();
      else if (position.phase?.kind === "riposo") beepRest();
    }

    const left = position.remaining;
    if (left <= 3 && left > 0) {
      const key = `${position.index}:${left}`;
      if (lastBeep.current !== key) {
        lastBeep.current = key;
        beepCountdown();
      }
    }
  }, [state, position.index, position.remaining, position.done, position.phase]);

  const start = useCallback(() => {
    unlockAudio();
    if (state === "corre") return;
    if (state === "finito") {
      offset.current = 0;
      setElapsed(0);
      lastBeep.current = "";
      lastPhase.current = -2;
    }
    startedAt.current = Date.now();
    setState("corre");
  }, [state]);

  const pause = useCallback(() => {
    if (state !== "corre") return;
    offset.current += (Date.now() - startedAt.current) / 1000;
    setElapsed(offset.current);
    setState("pausa");
  }, [state]);

  const reset = useCallback(() => {
    offset.current = 0;
    lastBeep.current = "";
    lastPhase.current = -2;
    setElapsed(0);
    setState("fermo");
  }, []);

  return { state, elapsed, total, phases, position, start, pause, reset };
}
