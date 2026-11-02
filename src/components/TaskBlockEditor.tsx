import { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";
import { Task, useTasks, TASK_COLORS, TASK_COLOR_NAMES } from "../lib/tasks";
import { isTemplate } from "../lib/scheduling";
import { minToLabel, WEEKDAY_LABELS, WEEKDAY_LABELS_FULL } from "../lib/dates";
import { ColorPicker, Dialog, Stepper, Switch } from "./ui";

/** 00:00 → 23:30 in 30-min steps for the time selects. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);

export function TaskBlockEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { updateTask, removeTask, tasks } = useTasks();
  const live = tasks.find((t) => t.id === task.id) ?? task;
  const projected = isTemplate(live);

  const [title, setTitle] = useState(live.title);
  const [est, setEst] = useState(live.estPomos);
  const [timed, setTimed] = useState(live.startMin != null);
  const [startMin, setStartMin] = useState(live.startMin ?? 9 * 60);
  const [endMin, setEndMin] = useState(live.endMin ?? (live.startMin ?? 9 * 60) + 60);
  const [color, setColor] = useState(live.color ?? TASK_COLORS[0]);
  const [weekdays, setWeekdays] = useState<number[]>(live.recur?.weekdays ?? []);
  const [allowOverlap, setAllowOverlap] = useState(!!live.allowOverlap);

  const save = useCallback(() => {
    updateTask(task.id, {
      title: title.trim() || "Untitled",
      estPomos: Math.max(1, est),
      startMin: timed ? startMin : undefined,
      endMin: timed ? Math.max(startMin + 15, endMin) : undefined,
      color,
      recur: weekdays.length ? { weekdays } : undefined,
      allowOverlap: allowOverlap || undefined,
    });
  }, [task.id, title, est, timed, startMin, endMin, color, weekdays, allowOverlap, updateTask]);

  // Save shortly after each change so the calendar updates live…
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const t = setTimeout(() => saveRef.current(), 150);
    return () => clearTimeout(t);
  }, [save]);

  // …and always flush on close, so the last keystrokes are never dropped.
  const close = useCallback(() => {
    saveRef.current();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const toggleWeekday = (i: number) =>
    setWeekdays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort((a, b) => a - b)));

  return (
    <Dialog
      title={projected ? "Weekly block" : "Block"}
      onClose={close}
      footer={
        <>
          <button onClick={() => { removeTask(task.id); onClose(); }} className="btn-text px-0 text-negative hover:text-negative">
            {projected ? "Delete the repeat" : "Delete block"}
          </button>
          <button onClick={close} className="btn-primary">Done</button>
        </>
      }
    >
      {projected && (
        <p className="mb-3 text-sm text-muted">This block repeats. Changes apply to every week from now on.</p>
      )}
      <label className="block text-sm font-medium" htmlFor="blk-title">Title</label>
      <input id="blk-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && close()} placeholder="What will you work on?"
        className="field mt-2" />

      <div className="mt-4 divide-y divide-line">
        <Row label="Estimated pomodoros">
          <Stepper value={est} min={1} max={20} onChange={setEst} label="estimated pomodoros" />
        </Row>
        <Row label="At a set time">
          <Switch checked={timed} onChange={setTimed} label="At a set time" />
        </Row>
        {timed && (
          <>
            <Row label="From – to">
              <div className="flex items-center gap-2">
                <TimeSelect label="Start time" value={startMin}
                  onChange={(v) => { setStartMin(v); if (v >= endMin) setEndMin(v + 60); }} />
                <span className="text-faint">–</span>
                <TimeSelect label="End time" value={endMin} min={startMin + 15} onChange={setEndMin} />
              </div>
            </Row>
            <Row label="Draw over other blocks">
              <Switch checked={allowOverlap} onChange={setAllowOverlap} label="Draw over other blocks" />
            </Row>
          </>
        )}
        <div className="py-3">
          <span className="text-sm">Colour</span>
          <div className="mt-2">
            <ColorPicker label="Block colour" size={20} value={color} onChange={setColor}
              presets={TASK_COLORS.map((c, i) => ({ color: c, name: TASK_COLOR_NAMES[i] ?? c }))} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium">Repeat every week on</p>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <button key={i} onClick={() => toggleWeekday(i)} aria-pressed={weekdays.includes(i)}
            aria-label={WEEKDAY_LABELS_FULL[i]}
            className={clsx("h-8 rounded-full text-xs font-medium transition-colors duration-150",
              weekdays.includes(i) ? "bg-invert text-on-invert" : "bg-raised text-muted hover:text-ink")}>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 min-h-[20px] text-xs text-muted">
        {weekdays.length
          ? `Shows up in Today every ${weekdays.map((i) => WEEKDAY_LABELS[i]).join(", ")}.`
          : "Once only."}
      </p>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 py-2">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function TimeSelect({ value, min = 0, onChange, label }: {
  value: number; min?: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <select value={value} aria-label={label} onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="h-9 rounded-full border border-control bg-ground px-3 text-sm text-ink focus:border-muted focus:outline-none">
      {TIME_OPTIONS.filter((m) => m >= min).map((m) => (
        <option key={m} value={m}>{minToLabel(m)}</option>
      ))}
    </select>
  );
}
