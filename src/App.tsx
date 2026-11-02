import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { BreakOverlay } from "./components/BreakOverlay";
import { MicroToast } from "./components/MicroToast";
import { TodayView } from "./components/TodayView";
import { WeekView } from "./components/WeekView";
import { SettingsView } from "./components/SettingsView";
import { Icon, Mark } from "./components/ui";
import { SchedulerConfig, useConfig } from "./lib/config";
import { useAppearance } from "./lib/theme";
import { playChime } from "./lib/sound";
import { TasksProvider, useTasks } from "./lib/tasks";
import { todayTasks } from "./lib/scheduling";
import { scheduler } from "./lib/ipc";
import { logSession } from "./lib/history";
import { toggleRunning, useTick } from "./lib/timer";
import { clock } from "./lib/format";
import { PHASE_LABEL } from "./lib/types";

type Route = "today" | "week" | "settings";

function readRoute(): string {
  return window.location.hash.replace(/^#\/?/, "") || "today";
}

function useRoute(): [Route, (r: Route) => void] {
  const [raw, setRaw] = useState(readRoute);
  useEffect(() => {
    const on = () => setRaw(readRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const route: Route = raw === "week" || raw === "settings" ? raw : "today";
  return [route, (r) => { window.location.hash = `/${r}`; }];
}

/** Everything that reacts to the scheduler outside of rendering: the chime,
 *  the session log and crediting the active task. Listeners subscribe once and
 *  read the latest config/active task through refs. */
function useSessionEffects(config: SchedulerConfig) {
  const { activeId, incrementActivePomo } = useTasks();
  const cfg = useRef(config);
  cfg.current = config;
  const active = useRef(activeId);
  active.current = activeId;
  const credit = useRef(incrementActivePomo);
  credit.current = incrementActivePomo;

  useEffect(() => {
    const offEnd = scheduler.onPhaseEnd((e) => {
      const c = cfg.current;
      if (c.sound_enabled) {
        playChime({ style: c.chime_style, volume: c.chime_volume, repeat: c.chime_repeat });
      }
      if (e.ended !== "Idle" && e.ended !== "MicroBreak") {
        logSession({
          phase: e.ended,
          secs: e.elapsed_secs,
          taskId: e.ended === "Work" ? active.current : null,
          skipped: e.skipped || e.is_postponed,
        });
      }
      // Only a focus session that ran out earns a pomodoro — not a skip.
      if (e.ended === "Work" && !e.is_postponed && !e.skipped) {
        credit.current(c.auto_check_tasks);
      }
    });
    const offMicro = scheduler.onMicroEnd(() => {
      logSession({ phase: "MicroBreak", secs: cfg.current.micro_break_duration_secs, skipped: false });
    });
    return () => { offEnd(); offMicro(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleRunning();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        scheduler.reset();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        scheduler.skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const NAV: { route: Route; label: string; icon: (p: { size?: number }) => JSX.Element }[] = [
  { route: "today", label: "Today", icon: Icon.Today },
  { route: "week", label: "Week", icon: Icon.Week },
  { route: "settings", label: "Settings", icon: Icon.Settings },
];

function Shell() {
  const [route, go] = useRoute();
  const [config, setConfig] = useConfig();
  const [appearance, setAppearance] = useAppearance();
  const { tasks } = useTasks();
  useSessionEffects(config);

  const openToday = todayTasks(tasks).filter((t) => !t.completed).length;

  return (
    <div className="flex h-full">
      {/* Sidebar — same ground as the page, divided by one rule. Folds below 1024px. */}
      <aside className="hidden w-[var(--sidebar)] flex-none flex-col border-r border-line lg:flex">
        <div className="flex h-[var(--topbar)] flex-none items-center gap-2.5 border-b border-line px-[22px]">
          <Mark />
          <span className="text-base font-semibold tracking-[-0.01em]">pokusFocus</span>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {NAV.slice(0, 2).map((n) => (
            <NavItem key={n.route} active={route === n.route} onClick={() => go(n.route)}
              icon={<n.icon />} label={n.label}
              count={n.route === "today" && openToday > 0 ? `${openToday} open` : undefined} />
          ))}
          <div className="flex-1" />
          <NavItem active={route === "settings"} onClick={() => go("settings")}
            icon={<Icon.Settings />} label="Settings" />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {route === "today" && <TodayView config={config} />}
        {route === "week" && <WeekView />}
        {route === "settings" && (
          <SettingsView config={config} onChange={setConfig} appearance={appearance} onAppearanceChange={setAppearance} />
        )}

        {/* Phone / tablet: the nav becomes a bottom bar of the three destinations. */}
        <nav aria-label="Main" className="flex h-14 flex-none border-t border-line lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {NAV.map((n) => (
            <button key={n.route} onClick={() => go(n.route)} aria-current={route === n.route ? "page" : undefined}
              className={clsx("flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                route === n.route ? "text-ink" : "text-faint hover:text-muted")}>
              <n.icon size={18} />
              {n.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, count }: {
  active: boolean; onClick: () => void; icon: ReactNode; label: string; count?: string;
}) {
  // On dark, the active item is marked by brightness alone (#bbb → #fff).
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined}
      className={clsx("flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
        active ? "text-ink" : "text-nav hover:text-ink")}>
      <span className={active ? "text-ink" : "text-faint"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count && <span className="num text-xs text-faint">{count}</span>}
    </button>
  );
}

/** Top bar used by every view: the screen's title on the left, its own
 *  context on the right. Always carries something real. */
export function TopBar({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex h-[var(--topbar)] flex-none items-center gap-4 border-b border-line px-4 sm:px-[29px]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="lg:hidden"><Mark size={20} /></span>
        <h1 className="truncate text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        {sub && <span className="hidden truncate text-sm text-muted sm:inline">{sub}</span>}
      </div>
      <div className="flex flex-none items-center gap-2">{children}</div>
    </header>
  );
}

/** The compact live clock for screens other than Today. */
export function LiveChip() {
  const t = useTick();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted sm:inline">{PHASE_LABEL[t.phase]}</span>
      <span className="num text-base font-medium">{clock(t.remaining_secs)}</span>
      <button className="btn-outline h-8 px-3" onClick={toggleRunning}
        aria-label={t.running ? "Pause" : "Start"}>
        {t.running ? <Icon.Pause size={14} /> : <Icon.Play size={14} />}
        <span className="hidden sm:inline">{t.running ? "Pause" : "Start"}</span>
      </button>
    </div>
  );
}

export function App() {
  const route = readRoute();
  if (route === "overlay") return <BreakOverlay />;
  if (route === "toast") return <MicroToast />;
  return (
    <TasksProvider>
      <Shell />
    </TasksProvider>
  );
}
