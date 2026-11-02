import { useRef, useState, useMemo, useLayoutEffect, useEffect } from "react";
import clsx from "clsx";
import { TopBar, LiveChip } from "../App";
import { Task, useTasks, TASK_COLORS } from "../lib/tasks";
import { weekDays, toISODate, isTodayISO, shortLabel, WEEKDAY_LABELS, minToLabel, addDays } from "../lib/dates";
import { TaskBlockEditor } from "./TaskBlockEditor";
import { Icon } from "./ui";
import { tasksForDay, isTemplate, pomodorosForDays } from "../lib/scheduling";
import { packDay, PlacedTask } from "../lib/layout";
import { plural } from "../lib/format";

const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const INITIAL_SCROLL_HOUR = 7;
const COLS = "64px repeat(7, minmax(92px, 1fr))";

/** A block being dragged: moved (time and, for one-off blocks, day) or resized. */
interface Drag {
  id: string; mode: "move" | "resize"; template: boolean;
  x0: number; y0: number; start0: number; end0: number;
  day: number; start: number; end: number; moved: boolean;
}
const SNAP = 15;
const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function WeekView() {
  const { tasks, addTask, updateTask } = useTasks();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<Task | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowMin = useNowMinutes();

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = INITIAL_SCROLL_HOUR * HOUR_PX;
  }, []);

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const isos = useMemo(() => days.map(toISODate), [days]);
  const week = pomodorosForDays(tasks, isos);

  // While dragging, the calendar renders the block at its new place (and re-packs).
  const shown = useMemo(() => {
    if (!drag?.moved) return tasks;
    return tasks.map((t) => t.id !== drag.id ? t
      : drag.template ? { ...t, startMin: drag.start, endMin: drag.end }
      : { ...t, date: isos[drag.day], startMin: drag.start, endMin: drag.end });
  }, [tasks, drag, isos]);

  const beginDrag = (e: React.PointerEvent, t: Task, day: number, mode: Drag["mode"]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const start = t.startMin ?? 0;
    const end = t.endMin ?? start + 60;
    setDrag({ id: t.id, mode, template: isTemplate(t), x0: e.clientX, y0: e.clientY,
      start0: start, end0: end, day, start, end, moved: false });
  };

  const dragging = drag != null;
  useEffect(() => {
    if (!dragging) return;
    document.body.style.userSelect = "none";
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current!;
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      const moved = d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
      const delta = Math.round(((dy / HOUR_PX) * 60) / SNAP) * SNAP;
      const next = { ...d, moved };
      if (d.mode === "move") {
        const len = d.end0 - d.start0;
        next.start = clampN(d.start0 + delta, 0, 24 * 60 - len);
        next.end = next.start + len;
        if (!d.template && gridRef.current) {
          const r = gridRef.current.getBoundingClientRect();
          const gutter = parseInt(COLS, 10);
          next.day = clampN(Math.floor((e.clientX - r.left - gutter) / ((r.width - gutter) / 7)), 0, 6);
        }
      } else {
        next.end = clampN(d.end0 + delta, d.start0 + SNAP, 24 * 60);
      }
      setDrag(next);
    };
    const onUp = () => {
      const d = dragRef.current!;
      setDrag(null);
      if (!d.moved) {
        const t = tasks.find((x) => x.id === d.id);
        if (t) setEditing(t);
        return;
      }
      updateTask(d.id, d.template
        ? { startMin: d.start, endMin: d.end }
        : { date: isos[d.day], startMin: d.start, endMin: d.end });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const map = new Map<string, { timed: Task[]; allDay: Task[]; done: number; planned: number }>();
    for (const iso of isos) {
      const { instances, projections } = tasksForDay(shown, iso);
      const all = [...instances, ...projections];
      const { done, planned } = pomodorosForDays(shown, [iso]);
      map.set(iso, {
        timed: all.filter((t) => t.startMin != null),
        allDay: all.filter((t) => t.startMin == null),
        done, planned,
      });
    }
    return map;
  }, [shown, isos]);

  const createAt = (dayISO: string, hour: number) => {
    const startMin = hour * 60;
    setEditing(addTask({ title: "", estPomos: 1, date: dayISO, startMin,
      endMin: Math.min(24 * 60, startMin + 60), color: TASK_COLORS[0] }));
  };

  return (
    <>
      <TopBar title="Week" sub={`${shortLabel(days[0])} – ${shortLabel(days[6])} · ${week.done} of ${plural(week.planned, "pomodoro")} done`}>
        <LiveChip />
      </TopBar>
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-1 border-b border-line px-4 py-2 sm:px-[29px]">
          <button className="btn-icon" onClick={() => setAnchor((d) => addDays(d, -7))} aria-label="Previous week"><Icon.Left /></button>
          <button className="btn-icon" onClick={() => setAnchor((d) => addDays(d, 7))} aria-label="Next week"><Icon.Right /></button>
          <button className="btn-text h-8" onClick={() => setAnchor(new Date())}>This week</button>
          <span className="ml-auto hidden text-xs text-faint md:inline">Click an empty hour to plan · drag a block to move it, its bottom edge to resize</span>
        </div>

        <Agenda isos={isos} days={days} byDay={byDay} onOpen={setEditing}
          onAdd={(iso) => createAt(iso, 9)} />

        <div ref={scrollRef} className="hidden min-h-0 flex-1 overflow-auto sm:block">
          <div className="min-w-[700px] px-4 sm:px-[29px]">
            {/* Day headers + all-day row stay pinned while the hours scroll. */}
            <div className="sticky top-0 z-30 bg-ground">
              <div className="grid border-b border-line" style={{ gridTemplateColumns: COLS }}>
                <div />
                {days.map((d, i) => {
                  const iso = isos[i];
                  const today = isTodayISO(iso);
                  const b = byDay.get(iso)!;
                  return (
                    <div key={iso} className={clsx("relative border-l border-line px-2.5 py-2", i >= 5 && "bg-surface/60")}>
                      {today && <span className="absolute inset-x-0 top-0 h-px bg-hue" aria-hidden />}
                      <div className="flex items-baseline gap-1.5">
                        <span className={clsx("text-[13px]", today ? "text-ink" : "text-muted")}>{WEEKDAY_LABELS[i]}</span>
                        <span className={clsx("num text-base", today ? "font-semibold text-ink" : "text-muted")}>{d.getDate()}</span>
                      </div>
                      <div className="num text-xs text-faint" title="Pomodoros done of planned">
                        {b.planned ? <><span className="text-muted">{b.done}</span>/{b.planned} pom.</> : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid border-b border-line" style={{ gridTemplateColumns: COLS }}>
                <div className="flex items-center whitespace-nowrap text-xs text-faint">Any time</div>
                {isos.map((iso, i) => (
                  <div key={iso} className={clsx("min-h-[34px] space-y-1 border-l border-line p-1", i >= 5 && "bg-surface/60")}>
                    {byDay.get(iso)!.allDay.map((t) => (
                      <button key={t.id} onClick={() => setEditing(t)} title={t.title}
                        className={clsx("flex h-6 w-full items-center gap-1.5 rounded-[6px] bg-raised px-1.5 text-left text-[13px]",
                          isTemplate(t) && "border border-dashed border-control bg-transparent",
                          t.completed && "text-faint line-through")}>
                        <span className="h-3 w-[3px] flex-none rounded-full" style={{ backgroundColor: t.color ?? TASK_COLORS[0] }} />
                        <span className="truncate">{t.title || "Untitled"}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div ref={gridRef} className={clsx("grid", drag?.moved && "cursor-grabbing")} style={{ gridTemplateColumns: COLS }}>
              <div>
                {HOURS.map((h) => (
                  <div key={h} className="relative" style={{ height: HOUR_PX }}>
                    {h > 0 && <span className="num absolute -top-2 right-2 text-xs text-faint">{minToLabel(h * 60)}</span>}
                  </div>
                ))}
              </div>
              {isos.map((iso, i) => {
                const today = isTodayISO(iso);
                return (
                  <div key={iso} className={clsx("relative border-l border-line", i >= 5 && "bg-surface/60")}>
                    {HOURS.map((h) => (
                      <button key={h} onClick={() => createAt(iso, h)} aria-label={`Plan a block ${WEEKDAY_LABELS[i]} ${minToLabel(h * 60)}`}
                        className="block w-full border-b border-line/60 transition-colors duration-150 hover:bg-raised/40"
                        style={{ height: HOUR_PX }} />
                    ))}
                    {packDay(byDay.get(iso)!.timed).map((p) => (
                      <TaskBlock key={p.task.id} placed={p} dragging={drag?.moved === true && drag.id === p.task.id}
                        onOpen={() => setEditing(p.task)}
                        onPointerDown={(e, mode) => beginDrag(e, p.task, i, mode)} />
                    ))}
                    {today && (
                      <span className="pointer-events-none absolute inset-x-0 z-20 h-px bg-hue" style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden>
                        <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-hue" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {editing && <TaskBlockEditor task={editing} onClose={() => setEditing(null)} />}
      </main>
    </>
  );
}

/** Phone: the week as a list of days — the grid needs ~700px to read. */
function Agenda({ isos, days, byDay, onOpen, onAdd }: {
  isos: string[]; days: Date[];
  byDay: Map<string, { timed: Task[]; allDay: Task[]; done: number; planned: number }>;
  onOpen: (t: Task) => void; onAdd: (iso: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:hidden">
      {isos.map((iso, i) => {
        const b = byDay.get(iso)!;
        const items = [...b.allDay, ...[...b.timed].sort((x, y) => (x.startMin ?? 0) - (y.startMin ?? 0))];
        const today = isTodayISO(iso);
        return (
          <section key={iso} className="border-b border-line py-3" aria-label={`${WEEKDAY_LABELS[i]} ${days[i].getDate()}`}>
            <div className="flex items-center gap-2">
              <h2 className={clsx("text-sm", today ? "font-semibold text-ink" : "text-muted")}>
                {WEEKDAY_LABELS[i]} {days[i].getDate()}{today && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-hue align-middle" />}
              </h2>
              <span className="num text-xs text-faint">{b.planned ? `${b.done}/${b.planned} pom.` : ""}</span>
              <button className="btn-icon ml-auto h-8 w-8" onClick={() => onAdd(iso)} aria-label={`Plan a block on ${WEEKDAY_LABELS[i]}`}><Icon.Plus size={14} /></button>
            </div>
            {items.length === 0 ? (
              <p className="mt-1 text-sm text-faint">Nothing planned.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {items.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => onOpen(t)} className={clsx("flex min-h-[44px] w-full items-center gap-2.5 rounded-xl bg-surface px-3 text-left",
                      isTemplate(t) && "border border-dashed border-control bg-transparent")}>
                      <span className="h-4 w-[3px] flex-none rounded-full" style={{ backgroundColor: t.color ?? TASK_COLORS[0] }} />
                      <span className={clsx("min-w-0 flex-1 truncate text-sm", t.completed && "text-faint line-through")}>{t.title || "Untitled"}</span>
                      <span className="num flex-none text-xs text-muted">
                        {t.startMin != null ? minToLabel(t.startMin) : "Any time"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TaskBlock({ placed, onOpen, onPointerDown, dragging }: {
  placed: PlacedTask; onOpen: () => void; dragging: boolean;
  onPointerDown: (e: React.PointerEvent, mode: "move" | "resize") => void;
}) {
  const { task, left, width, overlay } = placed;
  const start = task.startMin ?? 0;
  const end = task.endMin ?? start + 60;
  const top = (start / 60) * HOUR_PX;
  const height = Math.max(22, ((end - start) / 60) * HOUR_PX);
  const color = task.color ?? TASK_COLORS[0];
  const projected = isTemplate(task);

  return (
    <div
      role="button" tabIndex={0}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={clsx(
        "group/block absolute cursor-grab touch-none select-none overflow-hidden rounded-[6px] py-1 pl-2.5 pr-1.5 text-left transition-colors duration-150",
        dragging && "z-30 cursor-grabbing ring-1 ring-ink/60",
        projected ? "border border-dashed border-control bg-ground/80 hover:bg-raised" : "bg-raised hover:brightness-125",
        task.completed && "opacity-60",
      )}
      style={{
        top: top + 1, height: height - 2,
        left: `calc(${left * 100}% + 2px)`, width: `calc(${width * 100}% - 4px)`,
        zIndex: dragging ? 30 : overlay ? 10 : 1,
      }}
      title={`${task.title || "Untitled"} · ${minToLabel(start)}–${minToLabel(end)}${projected ? " · repeats weekly" : ""}`}
    >
      <span className="absolute inset-y-1 left-1 w-[3px] rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className={clsx("flex items-center gap-1 text-[13px] font-medium leading-4", task.completed && "line-through")}>
        {projected && <Icon.Repeat size={11} className="flex-none text-muted" />}
        <span className="truncate">{task.title || "Untitled"}</span>
      </span>
      {height > 40 && (
        <span className="num block truncate text-xs leading-4 text-muted">
          {minToLabel(start)}–{minToLabel(end)}
          {!projected && <span className="text-faint"> · {task.donePomos}/{task.estPomos}</span>}
        </span>
      )}
      {/* Resize handle: drag the bottom edge to change the end time. */}
      <span onPointerDown={(e) => onPointerDown(e, "resize")} aria-hidden
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover/block:opacity-100">
        <span className="mx-auto mt-0.5 block h-0.5 w-6 rounded-full bg-muted" />
      </span>
    </div>
  );
}

function useNowMinutes(): number {
  const calc = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [m, setM] = useState(calc);
  useEffect(() => {
    const id = window.setInterval(() => setM(calc()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return m;
}
