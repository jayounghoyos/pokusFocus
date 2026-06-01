import { useState, useEffect } from "react";
import clsx from "clsx";
import { Task, useTasks, TASK_COLORS } from "../lib/tasks";
import { minToLabel, WEEKDAY_LABELS } from "../lib/dates";

interface Props {
  task: Task;
  onClose: () => void;
}

/** 00:00 → 23:30 in 30-min steps for the time selects. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);

export function TaskBlockEditor({ task, onClose }: Props) {
  const { updateTask, removeTask, tasks } = useTasks();
  const live = tasks.find((t) => t.id === task.id) ?? task;

  const [title, setTitle] = useState(live.title);
  const [est, setEst] = useState(live.estPomos);
  const [timed, setTimed] = useState(live.startMin != null);
  const [startMin, setStartMin] = useState(live.startMin ?? 9 * 60);
  const [endMin, setEndMin] = useState(live.endMin ?? (live.startMin ?? 9 * 60) + 60);
  const [color, setColor] = useState(live.color ?? TASK_COLORS[0]);
  const [weekdays, setWeekdays] = useState<number[]>(live.recur?.weekdays ?? []);
  const [allowOverlap, setAllowOverlap] = useState(!!live.allowOverlap);

  // Persist on any change (debounced-ish via effect).
  useEffect(() => {
    const t = setTimeout(() => {
      updateTask(task.id, {
        title: title.trim() || "Untitled",
        estPomos: Math.max(1, est),
        startMin: timed ? startMin : undefined,
        endMin: timed ? Math.max(startMin + 15, endMin) : undefined,
        color,
        recur: weekdays.length ? { weekdays } : undefined,
        allowOverlap: allowOverlap || undefined,
      });
    }, 150);
    return () => clearTimeout(t);
  }, [title, est, timed, startMin, endMin, color, weekdays, allowOverlap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleWeekday = (i: number) =>
    setWeekdays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b),
    );

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">Task</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none" aria-label="Close">×</button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onClose()}
            placeholder="Task title"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-base
                       placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />

          <Row label="Estimated pomodoros">
            <Stepper value={est} min={1} max={20} onChange={setEst} />
          </Row>

          <Row label="Has a time">
            <Toggle checked={timed} onChange={setTimed} />
          </Row>

          {timed && (
            <>
              <div className="flex items-center gap-2 pl-1">
                <TimeSelect value={startMin} onChange={(v) => { setStartMin(v); if (v >= endMin) setEndMin(v + 60); }} />
                <span className="text-zinc-600 text-sm">→</span>
                <TimeSelect value={endMin} min={startMin + 15} onChange={setEndMin} />
              </div>
              <Row label="Allow overlapping others">
                <Toggle checked={allowOverlap} onChange={setAllowOverlap} />
              </Row>
            </>
          )}

          <Row label="Color">
            <div className="flex gap-1.5">
              {TASK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={clsx("h-5 w-5 rounded-full border transition-all",
                    color === c ? "border-zinc-100 scale-110" : "border-transparent hover:border-zinc-500")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Row>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-1.5">Repeat weekly on</p>
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleWeekday(i)}
                  className={clsx(
                    "flex-1 py-1.5 rounded text-[11px] font-medium transition-colors",
                    weekdays.includes(i)
                      ? "bg-focus-work/20 text-focus-work border border-focus-work/40"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300",
                  )}
                >
                  {label[0]}
                </button>
              ))}
            </div>
            {weekdays.length > 0 && (
              <p className="text-[10px] text-zinc-600 mt-1.5">
                Repeats every {weekdays.map((i) => WEEKDAY_LABELS[i]).join(", ")} — appears each week and in Today on those days.
              </p>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
          <button
            onClick={() => { removeTask(task.id); onClose(); }}
            className="text-xs text-red-400/80 hover:text-red-300"
          >
            Delete
          </button>
          <button onClick={onClose} className="btn-primary text-xs">Done</button>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-300">{label}</span>
      {children}
    </div>
  );
}

function TimeSelect({ value, min = 0, onChange }: { value: number; min?: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="h-8 bg-zinc-900 border border-zinc-800 rounded-md px-2 text-sm text-zinc-200
                 focus:outline-none focus:border-zinc-600"
    >
      {TIME_OPTIONS.filter((m) => m >= min).map((m) => (
        <option key={m} value={m}>{minToLabel(m)}</option>
      ))}
    </select>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-stretch h-8 rounded-md border border-zinc-800 overflow-hidden bg-zinc-900/40">
      <button onClick={() => onChange(clamp(value - 1))} disabled={value <= min}
        className="px-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 transition-colors text-sm">−</button>
      <span className="w-10 flex items-center justify-center text-sm tabular-nums">{value}</span>
      <button onClick={() => onChange(clamp(value + 1))} disabled={value >= max}
        className="px-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 transition-colors text-sm">+</button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-zinc-200" : "bg-zinc-800")}
    >
      <span className={clsx("inline-block h-3.5 w-3.5 rounded-full bg-zinc-950 transition-transform",
        checked ? "translate-x-5" : "translate-x-1")} />
    </button>
  );
}
