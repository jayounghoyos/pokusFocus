import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BreakOverlay } from "./components/BreakOverlay";
import { MicroToast } from "./components/MicroToast";
import { TaskList } from "./components/TaskList";
import { Settings } from "./components/Settings";
import { useConfig } from "./lib/config";
import { useTheme } from "./lib/theme";
import { playChime } from "./lib/sound";

type Phase = "Work" | "ShortBreak" | "LongBreak" | "MicroBreak" | "Idle";

interface TickEvent {
  phase: Phase;
  remaining_secs: number;
  total_secs: number;
  cycle: number;
}

interface PhaseEndEvent {
  ended: Phase;
  started: Phase;
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
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useConfig();
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    const unlisten = listen<TickEvent>("scheduler://tick", (e) => {
      setState(e.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<PhaseEndEvent>("scheduler://phase-end", () => {
      if (config.sound_enabled) {
        playChime({
          style: config.chime_style,
          volume: config.chime_volume,
          repeat: config.chime_repeat,
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [config.sound_enabled, config.chime_style, config.chime_volume, config.chime_repeat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) {
          invoke("scheduler_pause");
          setRunning(false);
        } else {
          invoke("scheduler_start");
          setRunning(true);
        }
      } else if (e.key === "r" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        invoke("scheduler_reset");
        setRunning(false);
      } else if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        invoke("scheduler_skip");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  const progress = state.total_secs > 0
    ? 1 - state.remaining_secs / state.total_secs
    : 0;

  return (
    <main className="h-full flex flex-col items-center justify-center gap-10 py-10 relative">
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-200 transition-colors"
        aria-label="Settings"
        title="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <section className="flex flex-col items-center">
        <p className="text-sm uppercase tracking-[0.22em] text-zinc-500 mb-3 transition-colors duration-500">
          {phaseLabel[state.phase]}
        </p>
        <p className="text-8xl font-light tabular-nums tracking-tight">
          {fmt(state.remaining_secs)}
        </p>

        <div className="w-80 mt-7 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className={`h-full ${phaseColor[state.phase]} transition-all duration-1000 ease-linear`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-7 flex gap-2">
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
            disabled={config.strict_mode && (state.phase === "ShortBreak" || state.phase === "LongBreak")}
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

      <TaskList autoCheck={config.auto_check_tasks} />

      {showSettings && (
        <Settings
          config={config}
          onChange={setConfig}
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}

export function App() {
  const route = window.location.hash.replace(/^#\/?/, "");

  if (route === "overlay") return <BreakOverlay />;
  if (route === "toast") return <MicroToast />;
  return <Dashboard />;
}
