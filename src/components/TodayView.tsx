import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { TopBar } from "../App";
import { DayStrip } from "./DayStrip";
import { TaskList } from "./TaskList";
import { NotesRail } from "./NotesRail";
import { Icon } from "./ui";
import type { SchedulerConfig } from "../lib/config";
import { useTasks } from "../lib/tasks";
import { backlogTasks, openTodayInOrder, pomodorosForDays, scheduledTodayTasks, todayTasks } from "../lib/scheduling";
import { minToLabel, toISODate, todayISO, weekDays } from "../lib/dates";
import { ladder, toggleRunning, useTick } from "../lib/timer";
import { scheduler } from "../lib/ipc";
import { sessionsOn, totals, useSessions } from "../lib/history";
import { clock, duration, longDate, plural } from "../lib/format";
import { PHASE_LABEL, isBreak } from "../lib/types";

/*
 * Grid (1440 window): sidebar 210 + 1px; gutters 29 → 1171px of canvas.
 * 12 columns × 84.75 + 11 × 14 = 1171. Row 1: 8 + 4. Row 2: 12. Row 3: 7 + 5.
 */
export function TodayView({ config }: { config: SchedulerConfig }) {
  const { tasks, activeId } = useTasks();
  const week = useMemo(() => weekDays(new Date()).map(toISODate), []);
  const wk = pomodorosForDays(tasks, week);
  // `?notes` opens the rail on the active task (used for design inspection).
  const [notesId, setNotesId] = useState<string | null>(() =>
    new URLSearchParams(location.search).has("notes") ? activeId : null);
  const rail = notesId != null && tasks.some((t) => t.id === notesId) ? notesId : null;

  useEffect(() => {
    if (!rail) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (e.key === "Escape" && tag !== "input" && tag !== "textarea" && !document.querySelector('[role="dialog"]')) {
        setNotesId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rail]);

  const lists = (
    <>
      <section className={clsx("panel col-span-12 flex flex-col", !rail && "md:col-span-7")} aria-labelledby="h-sched">
        <TaskList
          headingId="h-sched"
          title="Scheduled today"
          filter={(t) => scheduledTodayTasks(tasks).some((x) => x.id === t.id)}
          newTaskDefaults={() => ({ date: todayISO() })}
          sort={(a, b) => (a.startMin ?? Infinity) - (b.startMin ?? Infinity)}
          emptyHint="Nothing on the calendar for today. Plan blocks in Week, or add one here."
          notesId={rail} onOpenNotes={setNotesId}
        />
      </section>
      <section className={clsx("panel col-span-12 flex flex-col", !rail && "md:col-span-5")} aria-labelledby="h-any">
        <TaskList
          headingId="h-any"
          title="Anytime"
          filter={(t) => backlogTasks(tasks).some((x) => x.id === t.id)}
          emptyHint="Tasks with no day land here. Drag them into the order you want to take them."
          notesId={rail} onOpenNotes={setNotesId}
        />
      </section>
    </>
  );

  return (
    <>
      <TopBar title="Today" sub={longDate(new Date())}>
        <a href="#/week" className="btn-text h-8 text-sm">
          <span className="hidden md:inline">This week</span>
          <span className="num text-ink">{wk.done}</span>
          <span>of {plural(wk.planned, "pomodoro")}</span>
          <Icon.Right size={14} />
        </a>
      </TopBar>
      <main className="min-h-0 flex-1 overflow-y-auto">
        {/* Rail open: main column | 384px notes rail, one 14px gap (app-screens §3.4). */}
        <div className={clsx("p-4 sm:px-[29px] sm:py-6",
          rail && "lg:grid lg:grid-cols-[minmax(0,1fr)_384px] lg:items-start lg:gap-[var(--gap)]")}>
          <div className={clsx("grid grid-cols-12 gap-[var(--gap)]", rail && "max-lg:hidden")}>
            <NowPanel config={config} wide={!!rail} />
            {!rail && <DaySummary />}
            <DayStrip className="col-span-12" showFocusedTotal={!!rail} />
            {lists}
          </div>
          {/* ≥1024px a sticky column beside the lists; narrower, it replaces them
              (one region at a time) and Back returns to the list. */}
          {rail && (
            <aside className="animate-rise lg:sticky lg:top-0 lg:h-[calc(100vh-var(--topbar)-48px)]" aria-label="Task notes">
              <NotesRail taskId={rail} onClose={() => setNotesId(null)} />
            </aside>
          )}
        </div>
      </main>
    </>
  );
}

function NowPanel({ config, wide }: { config: SchedulerConfig; wide?: boolean }) {
  const t = useTick();
  const { tasks, activeId } = useTasks();
  const active = tasks.find((x) => x.id === activeId);
  const { position, of } = ladder(t);
  const progress = t.total_secs > 0 ? 1 - t.remaining_secs / t.total_secs : 0;
  const breakNow = isBreak(t.phase);
  const strictBreak = config.strict_mode && breakNow;

  const endsAt = new Date(Date.now() + t.remaining_secs * 1000)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  let next: string;
  if (t.phase === "Idle") next = `A ${duration(config.work_secs)} focus session starts when you press Start.`;
  else if (t.phase === "Work") {
    next = position >= of
      ? `Long break (${duration(config.long_break_secs)}) at ${endsAt}`
      : `Short break (${duration(config.short_break_secs)}) at ${endsAt}`;
  } else if (t.phase === "MicroBreak") next = "Drink some water. Focus picks up right after.";
  else next = `Back to focus at ${endsAt}`;

  return (
    <section className={clsx("panel col-span-12 flex flex-col", !wide && "lg:col-span-8")} aria-labelledby="h-now">
      <div className="flex items-center justify-between gap-4">
        <h2 id="h-now" className="panel-title">{PHASE_LABEL[t.phase]}</h2>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="num">Session {position} of {of}</span>
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: of }, (_, i) => {
              const done = i < position - 1 || (breakNow && i < position);
              const current = i === position - 1 && !breakNow && t.phase !== "Idle";
              return (
                <span key={i} className={clsx("h-1.5 w-5 rounded-full",
                  done ? "bg-hue" : current ? "bg-hue/40" : "bg-raised")} />
              );
            })}
          </span>
        </div>
      </div>

      <p className="num mt-3 text-[72px] font-normal leading-none tracking-[-0.03em]" aria-live="off">
        {clock(t.remaining_secs)}
      </p>

      <p className="mt-4 min-h-[20px] truncate text-sm">
        {active ? (
          <>
            <span className="text-muted">On </span>
            <span className="text-ink">{active.title || "Untitled"}</span>
            <span className="num text-muted"> · {active.donePomos} of {plural(active.estPomos, "pomodoro")}</span>
          </>
        ) : (
          <span className="text-muted">No task picked. Click one in the lists below to focus on it.</span>
        )}
      </p>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-raised" role="progressbar"
        aria-label={`${PHASE_LABEL[t.phase]} progress`} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}>
        <div className={clsx("h-full rounded-full transition-[width] duration-1000 ease-linear",
          t.phase === "Work" ? "bg-hue" : "bg-muted")} style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button className="btn-primary min-w-[104px]" onClick={toggleRunning}>
          {t.running ? <Icon.Pause size={14} /> : <Icon.Play size={14} />}
          {t.running ? "Pause" : t.phase === "Idle" ? "Start" : "Resume"}
        </button>
        <button className="btn-outline" onClick={() => scheduler.skip()} disabled={strictBreak || t.phase === "Idle"}
          title={strictBreak ? "Strict mode is on: breaks can't be skipped" : "Skip to the next phase (Ctrl+N)"}>
          <Icon.Skip size={14} /> Skip
        </button>
        <button className="btn-text" onClick={() => scheduler.reset()} title="Reset the cycle (Ctrl+R)">
          <Icon.Reset size={14} /> Reset
        </button>
        <span className="ml-auto text-sm text-muted">{next}</span>
      </div>
      <UpNext />
    </section>
  );
}

/** The task the clock moves to once the active one is done. */
function UpNext() {
  const { tasks, activeId, setActiveId } = useTasks();
  const next = openTodayInOrder(tasks, activeId)[0];
  return (
    <div className="mt-5 flex items-center gap-3 border-t border-line pt-3 text-sm">
      <span className="text-muted">Up next</span>
      {next ? (
        <>
          <span className="truncate">{next.title || "Untitled"}</span>
          {next.startMin != null && <span className="num flex-none text-muted">{minToLabel(next.startMin)}</span>}
          <button className="btn-text ml-auto h-7 flex-none" onClick={() => setActiveId(next.id)}>Focus on it now</button>
        </>
      ) : (
        <span className="text-muted">Nothing else open today.</span>
      )}
    </div>
  );
}

function DaySummary() {
  const sessions = useSessions();
  const { tasks } = useTasks();
  const day = totals(sessionsOn(sessions, todayISO()));
  const today = todayTasks(tasks);
  const doneTasks = today.filter((t) => t.completed).length;

  const rows: { label: string; value: string; sub?: string }[] = [
    { label: "Breaks taken", value: day.breaksDue ? `${day.breaksTaken} of ${day.breaksDue}` : "0",
      sub: day.breaksDue > day.breaksTaken ? `${day.breaksDue - day.breaksTaken} skipped` : undefined },
    { label: "Water breaks", value: String(day.waterBreaks) },
    { label: "Tasks done", value: today.length ? `${doneTasks} of ${today.length}` : "—" },
  ];

  return (
    <section className="panel col-span-12 flex flex-col lg:col-span-4" aria-labelledby="h-sofar">
      <h2 id="h-sofar" className="panel-title">Today so far</h2>
      <p className="mt-1 text-sm text-muted">Focused</p>
      <p className="num text-[32px] font-normal leading-tight tracking-[-0.02em]">{duration(day.focusSecs)}</p>
      <p className="text-sm text-muted num">
        {day.sessionsFinished ? `across ${plural(day.sessionsFinished, "finished session")}` : "No finished sessions yet"}
      </p>
      <dl className="mt-auto pt-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between border-t border-line py-2.5">
            <dt className="text-sm text-muted">{r.label}</dt>
            <dd className="num text-right text-base">
              {r.value}
              {r.sub && <span className="ml-2 text-xs text-faint">{r.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
