import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Phase = "Work" | "ShortBreak" | "LongBreak" | "MicroBreak" | "Idle";

interface TickEvent {
  phase: Phase;
  remaining_secs: number;
  total_secs: number;
  cycle: number;
}

const messages: Record<Phase, string> = {
  ShortBreak: "Stand up. Roll your shoulders. Look out a window.",
  LongBreak: "Step away from the desk. Walk. Drink water. Real stretch.",
  Work: "",
  MicroBreak: "",
  Idle: "",
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function BreakOverlay() {
  const [tick, setTick] = useState<TickEvent | null>(null);

  useEffect(() => {
    const unlisten = listen<TickEvent>("scheduler://tick", (e) => {
      const t = e.payload;
      if (t.phase === "ShortBreak" || t.phase === "LongBreak") {
        setTick(t);
      } else {
        getCurrentWindow().close().catch(() => {});
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!tick) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-400">
        Preparing break…
      </div>
    );
  }

  const progress = 1 - tick.remaining_secs / tick.total_secs;
  const tone = tick.phase === "LongBreak" ? "from-blue-950" : "from-emerald-950";

  return (
    <div
      className={`h-full w-full flex flex-col items-center justify-center
                  bg-gradient-to-br ${tone} via-zinc-950 to-zinc-950 text-zinc-100 select-none`}
    >
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-4">
        {tick.phase === "LongBreak" ? "Long break" : "Short break"}
      </p>
      <p className="text-[10rem] font-extralight tabular-nums leading-none">
        {fmt(tick.remaining_secs)}
      </p>
      <p className="mt-8 max-w-md text-center text-lg text-zinc-300">
        {messages[tick.phase]}
      </p>

      <div className="mt-16 w-2/3 max-w-2xl h-0.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-400 transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-12 flex gap-3">
        <button
          className="btn-ghost"
          onClick={async () => {
            await invoke("scheduler_skip");
            getCurrentWindow().close().catch(() => {});
          }}
        >
          Skip break
        </button>
      </div>
    </div>
  );
}
