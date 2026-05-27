import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Phase = "Work" | "ShortBreak" | "LongBreak" | "MicroBreak" | "Idle";

interface TickEvent {
  phase: Phase;
  remaining_secs: number;
  total_secs: number;
  cycle: number;
}

export function MicroToast() {
  const [tick, setTick] = useState<TickEvent | null>(null);

  useEffect(() => {
    const unlisten = listen<TickEvent>("scheduler://tick", (e) => {
      const t = e.payload;
      if (t.phase === "MicroBreak") {
        setTick(t);
      } else {
        getCurrentWindow().close().catch(() => {});
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!tick) return null;

  const progress = 1 - tick.remaining_secs / tick.total_secs;
  const circ = 2 * Math.PI * 28;

  return (
    <div className="h-full w-full flex items-center gap-3 px-4
                    bg-zinc-900/95 backdrop-blur rounded-2xl border border-zinc-800
                    text-zinc-100 select-none">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" stroke="#27272a" strokeWidth="4" fill="none" />
        <circle
          cx="32" cy="32" r="28"
          stroke="#a855f7" strokeWidth="4" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
        <text
          x="32" y="32" textAnchor="middle" dominantBaseline="central"
          className="fill-zinc-100 text-base font-medium tabular-nums"
        >
          {tick.remaining_secs}
        </text>
      </svg>
      <div className="text-sm">
        <p className="font-medium">Look away</p>
        <p className="text-xs text-zinc-400">20-20-20 · focus on something distant</p>
      </div>
    </div>
  );
}
