/**
 * Live scheduler state as an external store. Only components that call
 * useTick() re-render each second; task lists and the calendar do not.
 */
import { useSyncExternalStore } from "react";
import { scheduler } from "./ipc";
import type { TickEvent } from "./types";
import { loadConfig } from "./config";

// Before the first tick arrives, show the configured focus length, not 25:00.
const initialSecs = loadConfig().work_secs;
let current: TickEvent = {
  phase: "Idle",
  remaining_secs: initialSecs,
  total_secs: initialSecs,
  cycle: 0,
  running: false,
  long_break_every: 4,
};
const subs = new Set<() => void>();
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  scheduler.onTick((t) => {
    current = t;
    subs.forEach((fn) => fn());
  });
}

function subscribe(fn: () => void) {
  wire();
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useTick(): TickEvent {
  return useSyncExternalStore(subscribe, () => current);
}

export function getTick(): TickEvent {
  return current;
}

/** Start when stopped, pause when running — Space, the main button, the tray. */
export function toggleRunning() {
  return current.running ? scheduler.pause() : scheduler.start();
}

/**
 * Where the current focus session sits in the run-up to the long break.
 * During focus it is the session in progress (1-based); during a break it is
 * the session just finished.
 */
export function ladder(t: TickEvent): { position: number; of: number } {
  const of = Math.max(1, t.long_break_every);
  const inBreakOrDone = t.phase === "ShortBreak" || t.phase === "LongBreak";
  const done = t.cycle % of;
  if (inBreakOrDone) return { position: done === 0 ? of : done, of };
  return { position: done + 1, of };
}
