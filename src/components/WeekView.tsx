import { useRef, useState, useMemo, useLayoutEffect } from "react";
import clsx from "clsx";
import { Task, useTasks, TASK_COLORS } from "../lib/tasks";
import {
  weekDays, toISODate, isTodayISO, shortLabel, WEEKDAY_LABELS,
  minToLabel, addDays,
} from "../lib/dates";
import { TaskBlockEditor } from "./TaskBlockEditor";
import { tasksForDay, isTemplate } from "../lib/scheduling";
import { packDay, PlacedTask } from "../lib/layout";

const HOUR_PX = 48;
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);
const INITIAL_SCROLL_HOUR = 7;

export function WeekView() {
  const { tasks, addTask } = useTasks();
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<Task | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (INITIAL_SCROLL_HOUR - DAY_START_HOUR) * HOUR_PX;
    }
  }, []);

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const rangeLabel = `${shortLabel(days[0])} – ${shortLabel(days[6])}`;

  const byDay = useMemo(() => {
    const map = new Map<string, { timed: Task[]; allDay: Task[] }>();
    for (const d of days) {
      const iso = toISODate(d);
      const { instances, projections } = tasksForDay(tasks, iso);
      const all = [...instances, ...projections];
      const timed = all.filter((t) => t.startMin != null);
      const allDay = all.filter((t) => t.startMin == null);
      map.set(iso, { timed, allDay });
    }
    return map;
  }, [tasks, days]);

  const createAt = (dayISO: string, hour: number) => {
    const startMin = hour * 60;
    const t = addTask({
      title: "",
      estPomos: 1,
      date: dayISO,
      startMin,
      endMin: Math.min(24 * 60, startMin + 60),
      color: TASK_COLORS[0],
    });
    setEditing(t);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-2" onClick={() => setAnchor((d) => addDays(d, -7))} aria-label="Previous week">‹</button>
          <button className="btn-ghost text-xs" onClick={() => setAnchor(new Date())}>Today</button>
          <button className="btn-ghost px-2" onClick={() => setAnchor((d) => addDays(d, 7))} aria-label="Next week">›</button>
        </div>
        <span className="text-sm text-zinc-400 tabular-nums">{rangeLabel}</span>
      </header>

      {/* Day headers */}
      <div className="grid border-b border-zinc-800" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
        <div className="border-r border-zinc-800/60" />
        {days.map((d) => {
          const iso = toISODate(d);
          const today = isTodayISO(iso);
          return (
            <div key={iso} className={clsx("py-1.5 text-center border-r border-zinc-800/60", today && "bg-focus-work/5")}>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {WEEKDAY_LABELS[(d.getDay() + 6) % 7]}
              </div>
              <div className={clsx("text-sm tabular-nums", today ? "text-focus-work font-semibold" : "text-zinc-300")}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day / untimed row */}
      <div className="grid border-b border-zinc-800 min-h-[28px]" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
        <div className="border-r border-zinc-800/60 text-[9px] text-zinc-600 flex items-center justify-center">all-day</div>
        {days.map((d) => {
          const iso = toISODate(d);
          const bucket = byDay.get(iso);
          return (
            <div key={iso} className="border-r border-zinc-800/60 p-0.5 space-y-0.5">
              {bucket?.allDay.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditing(t)}
                  className={clsx(
                    "block w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate",
                    t.completed && "line-through opacity-60",
                  )}
                  style={{ backgroundColor: (t.color ?? TASK_COLORS[0]) + "33", color: t.color ?? TASK_COLORS[0] }}
                  title={t.title}
                >
                  {t.title || "Untitled"}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Scrollable hour grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="grid relative" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
          {/* hour gutter */}
          <div className="border-r border-zinc-800/60">
            {HOURS.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-1.5 right-1 text-[10px] text-zinc-600 tabular-nums">
                  {h === 0 ? "" : minToLabel(h * 60)}
                </span>
              </div>
            ))}
          </div>

          {/* day columns */}
          {days.map((d) => {
            const iso = toISODate(d);
            const bucket = byDay.get(iso);
            return (
              <div key={iso} className={clsx("relative border-r border-zinc-800/60", isTodayISO(iso) && "bg-focus-work/[0.03]")}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    onClick={() => createAt(iso, h)}
                    className="border-b border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                    style={{ height: HOUR_PX }}
                  />
                ))}
                {packDay(bucket?.timed ?? []).map((p) => (
                  <TaskBlock key={p.task.id} placed={p} onClick={() => setEditing(p.task)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {editing && (
        <TaskBlockEditor task={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function RepeatIcon({ color }: { color: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-0.5 -mt-0.5">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function TaskBlock({ placed, onClick }: { placed: PlacedTask; onClick: () => void }) {
  const { task, left, width, overlay } = placed;
  const start = task.startMin ?? 0;
  const end = task.endMin ?? start + 60;
  const top = ((start - DAY_START_HOUR * 60) / 60) * HOUR_PX;
  const height = Math.max(18, ((end - start) / 60) * HOUR_PX);
  const color = task.color ?? TASK_COLORS[0];
  const GAP = 2; // px between side-by-side columns

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        "absolute rounded px-1.5 py-0.5 text-left overflow-hidden",
        "border-l-2 transition-shadow hover:shadow-lg hover:z-20",
        task.completed && "opacity-50",
        overlay && "ring-1 ring-zinc-100/20",
      )}
      style={{
        top,
        height,
        left: `calc(${left * 100}% + 1px)`,
        width: `calc(${width * 100}% - ${GAP + 1}px)`,
        backgroundColor: color + (overlay ? "20" : "30"),
        borderLeftColor: color,
        zIndex: overlay ? 10 : 1,
      }}
      title={task.title}
    >
      <div className="text-[11px] font-semibold leading-tight truncate" style={{ color }}>
        {isTemplate(task) && <RepeatIcon color={color} />}
        {task.title || "Untitled"}
      </div>
      <div className="text-[9px] text-zinc-300/80 tabular-nums leading-tight truncate">
        {minToLabel(start)}{task.endMin != null && `–${minToLabel(end)}`}
      </div>
      {task.estPomos > 0 && height > 34 && (
        <div className="text-[9px] text-zinc-400 tabular-nums">
          {task.donePomos}/{task.estPomos}
        </div>
      )}
    </button>
  );
}
