import clsx from "clsx";
import { useTasks, TASK_COLORS, TASK_COLOR_NAMES } from "../lib/tasks";
import { minToLabel, fromISODate, todayISO } from "../lib/dates";
import { plural } from "../lib/format";
import { Check, ColorPicker, Icon, Stepper } from "./ui";
import { NotesEditor } from "./NotesEditor";

/**
 * The open task as an object: what it is, where it sits, and its notes.
 * Desktop: a column beside the lists. Phone: a full-screen sheet with Back.
 */
export function NotesRail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, updateTask, activeId, setActiveId } = useTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const isActive = task.id === activeId;
  const when = [
    task.date ? (task.date === todayISO() ? "Today" : fromISODate(task.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })) : "Anytime",
    task.startMin != null ? `${minToLabel(task.startMin)}${task.endMin != null ? `–${minToLabel(task.endMin)}` : ""}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="h-rail"
      className="flex flex-col lg:h-full lg:rounded-[20px] lg:bg-surface lg:p-[22px]">
      <header className="flex items-start gap-3">
        <button className="btn-text -ml-2 h-8 flex-none lg:hidden" onClick={onClose}><Icon.Left size={14} /> Back</button>
        <div className="min-w-0 flex-1">
          <h2 id="h-rail" className={clsx("text-base font-semibold leading-snug", task.completed && "text-muted line-through")}>
            {task.title || "Untitled"}
          </h2>
          <p className="num mt-0.5 text-sm text-muted">{when}</p>
        </div>
        <button className="btn-icon -mr-2 -mt-1 hidden flex-none lg:inline-flex" onClick={onClose} aria-label="Close notes"><Icon.Close /></button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isActive && !task.completed ? (
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-raised px-4 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-hue" /> Focusing on this
          </span>
        ) : (
          <button className="btn-outline" disabled={task.completed} onClick={() => setActiveId(task.id)}>Focus on this</button>
        )}
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted">
          <Check checked={task.completed} onChange={(v) => updateTask(task.id, { completed: v })} label="Done" />
          Done
        </label>
      </div>

      <dl className="mt-4 rounded-xl bg-ground/60 px-3.5">
        <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-line">
          <dt className="text-sm text-muted">Pomodoros</dt>
          <dd className="flex items-center gap-3">
            <span className="num text-sm"><span className="text-ink">{task.donePomos}</span><span className="text-faint"> done of</span></span>
            <Stepper label="estimated pomodoros" value={task.estPomos} min={1} max={20}
              onChange={(n) => updateTask(task.id, { estPomos: n })} />
          </dd>
        </div>
        <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 py-2">
          <dt className="text-sm text-muted">Colour</dt>
          <dd>
            <ColorPicker label="Task colour" size={18} value={task.color ?? "#6b6b6b"}
              presets={TASK_COLORS.map((c, i) => ({ color: c, name: TASK_COLOR_NAMES[i] ?? c }))}
              onChange={(hex) => updateTask(task.id, { color: hex })} />
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <NotesEditor taskKey={task.id} value={task.notes ?? ""} onChange={(v) => updateTask(task.id, { notes: v })} />
      </div>
      {task.completed && <p className="mt-2 text-xs text-faint">{plural(task.donePomos, "pomodoro")} spent.</p>}
    </section>
  );
}
