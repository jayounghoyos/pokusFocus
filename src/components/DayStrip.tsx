import { useEffect, useState } from "react";
import clsx from "clsx";
import { useTasks } from "../lib/tasks";
import { scheduledTodayTasks } from "../lib/scheduling";
import { todayISO, minToLabel } from "../lib/dates";
import { sessionsOn, useSessions } from "../lib/history";
import { useTick } from "../lib/timer";
import { duration } from "../lib/format";

/**
 * The Day strip — plan against what actually happened, on one hour axis.
 * "Planned" holds today's calendar blocks as outlines; "Focused" holds every
 * logged focus session in the data hue, breaks in grey and eye rests as ticks.
 */
export function DayStrip({ className, showFocusedTotal }: { className?: string; showFocusedTotal?: boolean }) {
  const { tasks } = useTasks();
  const sessions = useSessions();
  const tick = useTick();
  const now = useMinuteClock();

  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const planned = scheduledTodayTasks(tasks)
    .filter((t) => t.date === todayISO() && t.startMin != null)
    .map((t) => ({ task: t, start: t.startMin!, end: t.endMin ?? t.startMin! + 60 }));

  const logged = sessionsOn(sessions, todayISO()).map((e) => {
    const endD = new Date(e.endedAt);
    const end = endD.getHours() * 60 + endD.getMinutes() + endD.getSeconds() / 60;
    return { entry: e, start: Math.max(0, end - e.secs / 60), end };
  });

  // The session in progress, drawn up to now.
  const liveSecs = tick.phase === "Work" || tick.phase === "ShortBreak" || tick.phase === "LongBreak"
    ? tick.total_secs - tick.remaining_secs : 0;
  const live = liveSecs > 0 ? { phase: tick.phase, start: nowMin - liveSecs / 60, end: nowMin } : null;

  const mins = [nowMin, ...planned.flatMap((p) => [p.start, p.end]), ...logged.flatMap((l) => [l.start, l.end])];
  const startH = Math.max(0, Math.min(8, Math.floor(Math.min(...mins) / 60)));
  const endH = Math.min(24, Math.max(18, Math.ceil(Math.max(...mins) / 60 + 0.5)));
  const span = (endH - startH) * 60;
  const x = (m: number) => `${((m - startH * 60) / span) * 100}%`;
  const w = (a: number, b: number) => `${(Math.max(b - a, 0) / span) * 100}%`;
  const step = endH - startH > 12 ? 3 : 2;
  const ticks: number[] = [];
  for (let h = Math.ceil(startH / step) * step; h <= endH; h += step) ticks.push(h);

  const focus = logged.filter((l) => l.entry.phase === "Work");
  const breaks = logged.filter((l) => l.entry.phase === "ShortBreak" || l.entry.phase === "LongBreak");
  const water = logged.filter((l) => l.entry.phase === "MicroBreak");

  return (
    <section className={clsx("panel", className)} aria-labelledby="h-strip">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="h-strip" className="panel-title">
          Planned and focused
          {showFocusedTotal && (
            <span className="num ml-2 font-normal text-muted">· {duration(focus.reduce((n, f) => n + f.entry.secs, 0))} focused</span>
          )}
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Key">
          {planned.length > 0 && <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[3px] border border-control" />Planned</li>}
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[3px] bg-hue" />Focus</li>
          {(breaks.length > 0 || (live && live.phase !== "Work")) && <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[3px] bg-rest" />Break</li>}
          {water.length > 0 && <li className="flex items-center gap-1.5"><span className="h-2.5 w-px bg-ink" />Water</li>}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-[64px_1fr] gap-x-3 gap-y-2 sm:grid-cols-[72px_1fr]">
        <span className="self-center text-xs text-muted">Planned</span>
        <div className="relative h-7">
          {planned.length === 0 && (
            <span className="absolute inset-0 flex items-center rounded-lg border border-dashed border-control px-3 text-xs text-faint">
              No time blocks today
            </span>
          )}
          {planned.map((p) => (
            <div key={p.task.id} title={`${p.task.title} · ${minToLabel(p.start)}–${minToLabel(p.end)}`}
              className={clsx("absolute inset-y-0 flex items-center overflow-hidden rounded-lg border border-control pl-2 pr-1",
                p.task.completed && "opacity-50")}
              style={{ left: x(p.start), width: `calc(${w(p.start, p.end)} - 2px)` }}>
              <span className="mr-1.5 h-3 w-[3px] flex-none rounded-full" style={{ backgroundColor: p.task.color ?? "#6b6b6b" }} />
              <span className={clsx("truncate text-xs", p.task.completed ? "text-faint line-through" : "text-muted")}>
                {p.task.title || "Untitled"}
              </span>
            </div>
          ))}
          <NowLine left={x(nowMin)} />
        </div>

        <span className="self-center text-xs text-muted">Focused</span>
        <div className="relative h-7 rounded-lg bg-raised/40">
          {breaks.map((b) => (
            <div key={b.entry.id} className="absolute inset-y-1.5 rounded-[4px] bg-rest"
              style={{ left: x(b.start), width: w(b.start, b.end) }}
              title={`${b.entry.phase === "LongBreak" ? "Long break" : "Short break"} · ${Math.round(b.entry.secs / 60)} m${b.entry.skipped ? ", skipped" : ""}`} />
          ))}
          {focus.map((f) => (
            <div key={f.entry.id} className={clsx("absolute inset-y-0 rounded-[5px] bg-hue", f.entry.skipped && "opacity-50")}
              style={{ left: x(f.start), width: `calc(${w(f.start, f.end)} - 1px)` }}
              title={`Focus · ${Math.round(f.entry.secs / 60)} m${f.entry.skipped ? ", cut short" : ""}`} />
          ))}
          {live && (
            <div className={clsx("absolute rounded-[5px]", live.phase === "Work" ? "inset-y-0 bg-hue/60" : "inset-y-1.5 bg-rest/70")}
              style={{ left: x(live.start), width: w(live.start, live.end) }} title="In progress" />
          )}
          {water.map((r) => (
            <span key={r.entry.id} className="absolute -top-1 h-1.5 w-px bg-ink" style={{ left: x(r.end) }} aria-hidden />
          ))}
          <NowLine left={x(nowMin)} />
        </div>

        <span />
        <div className="relative h-4 text-xs text-faint">
          {ticks.map((h, i) => (
            <span key={h} className={clsx("num absolute -translate-x-1/2 whitespace-nowrap", i === 0 && "translate-x-0", h === endH && "-translate-x-full",
              i % 2 === 1 && "hidden sm:inline")} style={{ left: x(h * 60) }}>
              {minToLabel(h * 60)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function NowLine({ left }: { left: string }) {
  return <span className="pointer-events-none absolute -inset-y-1 w-px bg-hue" style={{ left }} aria-hidden />;
}

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
