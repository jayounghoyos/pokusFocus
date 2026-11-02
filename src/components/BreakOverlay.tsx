import { useEffect, useState } from "react";
import { loadConfig } from "../lib/config";
import { stopAllChimes } from "../lib/sound";
import { closeOwnWindow, scheduler } from "../lib/ipc";
import { clock, duration } from "../lib/format";
import type { TickEvent } from "../lib/types";
import { Mark } from "./ui";

const MOVES: Record<"ShortBreak" | "LongBreak", { lead: string; moves: string[] }> = {
  ShortBreak: {
    lead: "Stand up. Let your eyes go far.",
    moves: ["Roll your shoulders back, five times", "Look out of a window for twenty seconds", "Unclench your jaw and hands"],
  },
  LongBreak: {
    lead: "Step away from the desk.",
    moves: ["Walk to another room, or outside", "Drink a glass of water", "Stretch your back and the backs of your legs"],
  },
};

/** Fullscreen break window. It closes itself only when the scheduler says the
 *  break is over — so in strict mode there is no way around it but the clock. */
export function BreakOverlay() {
  const [tick, setTick] = useState<TickEvent | null>(null);
  const config = loadConfig();
  const strict = config.strict_mode;

  useEffect(() => scheduler.onTick((t) => {
    if (t.phase === "ShortBreak" || t.phase === "LongBreak") setTick(t);
    else { stopAllChimes(); closeOwnWindow(); }
  }), []);

  const postpone = () => { stopAllChimes(); scheduler.postpone(config.postpone_secs); };
  const skip = () => { stopAllChimes(); scheduler.skip(); };

  useEffect(() => {
    if (strict) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "p" || e.key === "P") postpone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!tick) return <div className="h-full bg-ground" />;

  const kind = tick.phase as "ShortBreak" | "LongBreak";
  const { lead, moves } = MOVES[kind];
  const progress = tick.total_secs ? 1 - tick.remaining_secs / tick.total_secs : 0;

  return (
    <main className="flex h-full select-none flex-col bg-ground px-[8vw] py-[7vh] animate-rise">
      <header className="flex items-center gap-2.5 text-muted">
        <Mark size={20} />
        <span className="text-sm">{kind === "LongBreak" ? "Long break" : "Short break"} · {duration(tick.total_secs)}</span>
      </header>

      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[32px] font-medium leading-tight tracking-[-0.02em]">{lead}</h1>
        <p className="num mt-6 text-[clamp(96px,16vw,200px)] font-light leading-none tracking-[-0.04em]" aria-label={`${clock(tick.remaining_secs)} left`}>
          {clock(tick.remaining_secs)}
        </p>
        <div className="mt-8 h-[3px] max-w-3xl overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full bg-muted transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
        <ul className="mt-10 grid max-w-3xl gap-3 text-lg text-muted sm:grid-cols-3">
          {moves.map((m) => <li key={m} className="rounded-2xl bg-surface px-5 py-4 text-base text-ink">{m}</li>)}
        </ul>
      </div>

      <footer className="flex flex-wrap items-center gap-3">
        {strict ? (
          <p className="text-sm text-muted">Strict mode is on. The break ends when the clock does.</p>
        ) : (
          <>
            <button className="btn-outline" onClick={postpone}>Postpone {duration(config.postpone_secs)}</button>
            <button className="btn-text" onClick={skip}>Skip break</button>
            <span className="ml-auto text-xs text-faint"><kbd className="kbd">P</kbd> postpone · <kbd className="kbd">Esc</kbd> skip</span>
          </>
        )}
      </footer>
    </main>
  );
}
