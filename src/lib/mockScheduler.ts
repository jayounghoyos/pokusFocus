/**
 * Browser stand-in for the Rust scheduler, used only when the UI runs outside
 * Tauri (plain `vite` / `vite preview`, design inspection). It mirrors the
 * phase rules of src-tauri/src/scheduler.rs closely enough to drive every
 * screen; the Rust side remains the source of truth in the real app.
 */
import type { Phase, PhaseEndEvent, TickEvent } from "./types";
import type { SchedulerConfig } from "./config";

type Listener<T> = (payload: T) => void;

export interface MockSeed {
  phase: Phase;
  remaining_secs: number;
  cycle: number;
  running: boolean;
}

export class MockScheduler {
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private cfg = {
    work_secs: 1500, short_break_secs: 300, long_break_secs: 900, long_break_every: 4,
    micro_break_enabled: true, micro_break_interval_secs: 1800, micro_break_duration_secs: 30,
    auto_advance: true, strict_mode: false,
  };
  private phase: Phase = "Idle";
  private remaining = 1500;
  private total = 1500;
  private cycle = 0;
  private running = false;
  private sinceMicro = 0;
  private micro = 0;
  private postponed: { phase: Phase; total: number } | null = null;

  constructor() {
    window.setInterval(() => this.tick(), 1000);
  }

  seed(s: MockSeed) {
    this.phase = s.phase;
    this.total = this.totalFor(s.phase);
    this.remaining = s.remaining_secs;
    this.cycle = s.cycle;
    this.running = s.running;
  }

  on<T>(event: string, fn: Listener<T>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn as Listener<unknown>);
    this.listeners.set(event, set);
    return () => set.delete(fn as Listener<unknown>);
  }

  private emit<T>(event: string, payload: T) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  private totalFor(p: Phase) {
    if (p === "ShortBreak") return this.cfg.short_break_secs;
    if (p === "LongBreak") return this.cfg.long_break_secs;
    return this.cfg.work_secs;
  }

  private snapshot(): TickEvent {
    const every = Math.max(1, this.cfg.long_break_every);
    if (this.micro > 0) {
      return { phase: "MicroBreak", remaining_secs: this.micro, total_secs: this.cfg.micro_break_duration_secs,
        cycle: this.cycle, running: this.running, long_break_every: every };
    }
    return { phase: this.phase, remaining_secs: this.remaining, total_secs: this.total,
      cycle: this.cycle, running: this.running, long_break_every: every };
  }

  private endPhase(skipped: boolean) {
    const ended = this.phase;
    const elapsed = this.total - this.remaining;
    const isPostponed = ended === "Work" && this.postponed !== null;
    if (ended === "Work" && this.postponed) {
      this.phase = this.postponed.phase;
      this.total = this.remaining = this.postponed.total;
      this.postponed = null;
    } else if (ended === "Work") {
      this.cycle += 1;
      this.phase = this.cycle % Math.max(1, this.cfg.long_break_every) === 0 ? "LongBreak" : "ShortBreak";
      this.total = this.remaining = this.totalFor(this.phase);
    } else {
      this.phase = "Work";
      this.total = this.remaining = this.cfg.work_secs;
    }
    const payload: PhaseEndEvent = { ended, started: this.phase, is_postponed: isPostponed,
      elapsed_secs: elapsed, skipped };
    this.emit("scheduler://phase-end", payload);
  }

  private tick() {
    if (this.running) {
      if (this.micro > 0) {
        this.micro -= 1;
        if (this.micro === 0) this.emit("scheduler://micro-end", null);
      } else {
        this.remaining = Math.max(0, this.remaining - 1);
        if (this.phase === "Work" && this.cfg.micro_break_enabled
            && this.remaining > this.cfg.micro_break_duration_secs + 5) {
          this.sinceMicro += 1;
          if (this.sinceMicro >= this.cfg.micro_break_interval_secs) {
            this.sinceMicro = 0;
            this.micro = this.cfg.micro_break_duration_secs;
            this.emit("scheduler://micro-start", null);
          }
        }
        if (this.remaining === 0) {
          this.endPhase(false);
          if (!this.cfg.auto_advance) this.running = false;
        }
      }
    }
    this.emit("scheduler://tick", this.snapshot());
  }

  invoke(cmd: string, args?: Record<string, unknown>): unknown {
    switch (cmd) {
      case "scheduler_start":
        if (this.phase === "Idle") { this.phase = "Work"; this.total = this.remaining = this.cfg.work_secs; }
        this.running = true;
        break;
      case "scheduler_pause":
        this.running = false;
        break;
      case "scheduler_skip":
        if (this.micro > 0) { this.micro = 0; this.emit("scheduler://micro-end", null); break; }
        if (this.cfg.strict_mode && (this.phase === "ShortBreak" || this.phase === "LongBreak")) break;
        if (this.phase !== "Idle") this.endPhase(true);
        break;
      case "scheduler_reset":
        this.running = false; this.phase = "Idle"; this.cycle = 0; this.micro = 0; this.postponed = null;
        this.total = this.remaining = this.cfg.work_secs;
        break;
      case "scheduler_postpone": {
        if (this.cfg.strict_mode || !(this.phase === "ShortBreak" || this.phase === "LongBreak")) break;
        const secs = Number(args?.secs ?? 300);
        this.postponed = { phase: this.phase, total: this.total };
        this.emit<PhaseEndEvent>("scheduler://phase-end", { ended: this.phase, started: "Work",
          is_postponed: true, elapsed_secs: this.total - this.remaining, skipped: true });
        this.phase = "Work"; this.total = this.remaining = secs;
        break;
      }
      case "scheduler_update_config": {
        const c = args?.config as SchedulerConfig;
        this.cfg = { ...this.cfg, ...c };
        if (this.phase === "Idle") this.total = this.remaining = this.cfg.work_secs;
        break;
      }
    }
    this.emit("scheduler://tick", this.snapshot());
    return undefined;
  }
}
