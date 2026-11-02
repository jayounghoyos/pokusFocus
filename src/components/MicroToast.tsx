import { useEffect, useState } from "react";
import { closeOwnWindow, scheduler } from "../lib/ipc";
import type { TickEvent } from "../lib/types";

/** The water-break card: a small window in the corner, never a full screen. */
export function MicroToast() {
  const [tick, setTick] = useState<TickEvent | null>(null);

  useEffect(() => {
    // Transparent window: only the card itself paints.
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return scheduler.onTick((t) => {
      if (t.phase === "MicroBreak") setTick(t);
      else closeOwnWindow();
    });
  }, []);

  if (!tick) return null;
  const progress = tick.total_secs ? 1 - tick.remaining_secs / tick.total_secs : 0;
  const r = 24;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex h-full w-full select-none items-center gap-3.5 rounded-[20px] bg-surface px-4 text-ink">
      <svg width="56" height="56" viewBox="0 0 56 56" className="flex-none" aria-hidden>
        <circle cx="28" cy="28" r={r} stroke="rgb(var(--raised))" strokeWidth="3" fill="none" />
        <circle cx="28" cy="28" r={r} stroke="rgb(var(--hue))" strokeWidth="3" fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dashoffset 1s linear" }} />
        {/* a glass, filling as the break runs */}
        <clipPath id="glass"><path d="M21 19h14l-1.6 17.2a2 2 0 0 1-2 1.8h-6.8a2 2 0 0 1-2-1.8z" /></clipPath>
        <path d="M21 19h14l-1.6 17.2a2 2 0 0 1-2 1.8h-6.8a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="20" y={38 - 17 * progress} width="16" height={17 * progress} fill="rgb(var(--hue))" opacity="0.55" clipPath="url(#glass)"
          style={{ transition: "y 1s linear, height 1s linear" }} />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-medium">Drink some water</p>
        <p className="num text-xs text-muted">Water break · {tick.remaining_secs} s left, then back to focus</p>
      </div>
    </div>
  );
}
