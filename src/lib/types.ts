/** Wire types shared with the Rust scheduler (src-tauri/src/scheduler.rs). */

export type Phase = "Idle" | "Work" | "ShortBreak" | "LongBreak" | "MicroBreak";

export interface TickEvent {
  phase: Phase;
  remaining_secs: number;
  total_secs: number;
  /** Focus sessions finished since the last reset. */
  cycle: number;
  running: boolean;
  long_break_every: number;
}

export interface PhaseEndEvent {
  ended: Phase;
  started: Phase;
  is_postponed: boolean;
  /** Seconds actually spent in the phase that ended. */
  elapsed_secs: number;
  /** Ended early by skip or postpone rather than running out. */
  skipped: boolean;
}

export const PHASE_LABEL: Record<Phase, string> = {
  Idle: "Ready",
  Work: "Focus",
  ShortBreak: "Short break",
  LongBreak: "Long break",
  MicroBreak: "Water break",
};

export const isBreak = (p: Phase) => p === "ShortBreak" || p === "LongBreak";
