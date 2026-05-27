import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BreakOverlay } from "./components/BreakOverlay";
import { MicroToast } from "./components/MicroToast";

type Phase = "Work" | "ShortBreak" | "LongBreak" | "MicroBreak" | "Idle";

interface TickEvent {
  phase: Phase;
  remaining_secs: number;
  total_secs: number;
  cycle: number;
}

const phaseColor: Record<Phase, string> = {
  Work: "bg-focus-work",
  ShortBreak: "bg-focus-short",
  LongBreak: "bg-focus-long",
  MicroBreak: "bg-focus-micro",
  Idle: "bg-zinc-700",
};

const phaseLabel: Record<Phase, string> = {
  Work: "Focus",
  ShortBreak: "Short break",
  LongBreak: "Long break",
  MicroBreak: "Micro break",
  Idle: "Idle",
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function Dashboard() {
  const [state, setState] = useState<TickEvent>({
    phase: "Idle",
    remaining_secs: 25 * 60,
    total_secs: 25 * 60,
    cycle: 0,
  });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const unlistenP = listen<TickEvent>("scheduler://tick", (e) => {
      setState(e.payload);
    });
    return () => {
      unlistenP.then((fn) => fn());
    };
  }, []);

  const progress = state.total_secs > 0
    ? 1 - state.remaining_secs / state.total_secs
    : 0;

  return (
    <main className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${phaseColor[state.phase]}`} />
          <h1 className="text-sm font-medium tracking-wide text-zinc-300">
            pokusFocus
          </h1>
        </div>
        <span className="text-xs text-zinc-500">cycle {state.cycle}</span>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
          {phaseLabel[state.phase]}
        </p>
        <p className="text-7xl font-light tabular-nums tracking-tight">
          {fmt(state.remaining_secs)}
        </p>

        <div className="w-full max-w-sm mt-8 h-1 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className={`h-full ${phaseColor[state.phase]} transition-[width] duration-1000 ease-linear`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-8 flex gap-2">
          {!running ? (
            <button
              className="btn-primary"
              onClick={async () => {
                await invoke("scheduler_start");
                setRunning(true);
              }}
            >
              Start
            </button>
          ) : (
            <button
              className="btn-ghost"
              onClick={async () => {
                await invoke("scheduler_pause");
                setRunning(false);
              }}
            >
              Pause
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={async () => {
              await invoke("scheduler_skip");
            }}
          >
            Skip
          </button>
          <button
            className="btn-ghost"
            onClick={async () => {
              await invoke("scheduler_reset");
              setRunning(false);
            }}
          >
            Reset
          </button>
        </div>
      </section>

      <footer className="px-6 pb-4 text-center text-xs text-zinc-600">
        v0.1.0 · personal build
      </footer>
    </main>
  );
}

export function App() {
  const route = window.location.hash.replace(/^#\/?/, "");

  if (route === "overlay") return <BreakOverlay />;
  if (route === "toast") return <MicroToast />;
  return <Dashboard />;
}
