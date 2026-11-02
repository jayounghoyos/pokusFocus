/**
 * The one place the UI talks to the backend. Inside Tauri it uses the real IPC;
 * in a plain browser (vite dev/preview, design inspection) it drives an
 * in-memory MockScheduler so every screen still renders and runs.
 */
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type { PhaseEndEvent, TickEvent } from "./types";
import { MockScheduler } from "./mockScheduler";

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let mock: MockScheduler | null = null;
export function browserScheduler(): MockScheduler {
  if (!mock) mock = new MockScheduler();
  return mock;
}

export async function invoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  if (inTauri) {
    await tauriInvoke(cmd, args);
  } else {
    browserScheduler().invoke(cmd, args);
  }
}

type Unlisten = () => void;

/** Subscribe to a scheduler event; returns a synchronous unsubscribe. */
export function listen<T>(event: string, fn: (payload: T) => void): Unlisten {
  if (!inTauri) return browserScheduler().on<T>(event, fn);
  let disposed = false;
  let off: Unlisten | null = null;
  tauriListen<T>(event, (e) => fn(e.payload)).then((u) => {
    if (disposed) u();
    else off = u;
  });
  return () => {
    disposed = true;
    off?.();
  };
}

export const scheduler = {
  start: () => invoke("scheduler_start"),
  pause: () => invoke("scheduler_pause"),
  skip: () => invoke("scheduler_skip"),
  reset: () => invoke("scheduler_reset"),
  postpone: (secs: number) => invoke("scheduler_postpone", { secs }),
  onTick: (fn: (t: TickEvent) => void) => listen<TickEvent>("scheduler://tick", fn),
  onPhaseEnd: (fn: (e: PhaseEndEvent) => void) => listen<PhaseEndEvent>("scheduler://phase-end", fn),
  onMicroEnd: (fn: () => void) => listen<null>("scheduler://micro-end", fn),
};

/** Closes the window this webview lives in (overlay / toast). No-op in a browser. */
export async function closeOwnWindow() {
  if (!inTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close().catch(() => {});
}

export const autostart = {
  async isEnabled(): Promise<boolean> {
    if (!inTauri) return false;
    const m = await import("@tauri-apps/plugin-autostart");
    return m.isEnabled();
  },
  async set(on: boolean): Promise<void> {
    if (!inTauri) return;
    const m = await import("@tauri-apps/plugin-autostart");
    await (on ? m.enable() : m.disable());
  },
};
