import { useEffect, useRef, useState, FormEvent, KeyboardEvent } from "react";
import clsx from "clsx";
import { Check, Icon } from "./ui";
import { Task, useTasks } from "../lib/tasks";
import { minToLabel } from "../lib/dates";

interface Props {
  title: string;
  headingId: string;
  /** Which tasks this list shows. */
  filter: (t: Task) => boolean;
  /** Optional ordering applied to visible tasks (e.g. by start time). */
  sort?: (a: Task, b: Task) => number;
  /** Fields stamped onto a task added here (Scheduled today adds today's date). */
  newTaskDefaults?: () => Partial<Task>;
  emptyHint: string;
  /** The task whose notes are open in the rail (its row shows as selected). */
  notesId?: string | null;
  onOpenNotes: (id: string | null) => void;
}

export function TaskList({ title, headingId, filter, sort, newTaskDefaults, emptyHint, notesId, onOpenNotes }: Props) {
  const { tasks, activeId, setActiveId, addTask, updateTask, removeTask, reorder } = useTasks();

  const [draft, setDraft] = useState("");
  const [est, setEst] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  // Reorder by pointer (not HTML5 drag-and-drop, which webviews handle unevenly):
  // press the grip, move over another row, release to drop it there.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropRef = useRef<string | null>(null);
  dropRef.current = dropId;
  useEffect(() => {
    if (!dragId) return;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    const onMove = (e: PointerEvent) => {
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-row-id]");
      const id = over && listRef.current?.contains(over) ? over.dataset.rowId! : null;
      setDropId(id && id !== dragId ? id : null);
    };
    const onUp = () => {
      if (dropRef.current) reorder(dragId, dropRef.current);
      setDragId(null);
      setDropId(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { setDragId(null); setDropId(null); } };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [dragId, reorder]);

  const filtered = tasks.filter(filter);
  const visible = sort ? [...filtered].sort(sort) : filtered;
  const openTasks = visible.filter((t) => !t.completed);
  const done = visible.filter((t) => t.completed);

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    addTask({ title: trimmed, estPomos: Math.max(1, est | 0), ...(newTaskDefaults?.() ?? {}) });
    setDraft("");
    setEst(1);
  };

  const saveEdit = () => {
    if (editingId && editTitle.trim()) updateTask(editingId, { title: editTitle.trim() });
    setEditingId(null);
  };
  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditingId(null);
  };

  const row = (t: Task, draggable: boolean) => {
    const isActive = t.id === activeId;
    const isEditing = editingId === t.id;
    const open = notesId === t.id;
    const time = t.startMin != null
      ? `${minToLabel(t.startMin)}${t.endMin != null ? `–${minToLabel(t.endMin)}` : ""}` : null;
    return (
      <li key={t.id}>
        <div
          data-row-id={draggable ? t.id : undefined}
          className={clsx(
            "group flex h-11 items-center gap-2.5 rounded-xl px-2 transition-colors duration-150",
            open ? "bg-raised" : "hover:bg-raised/50",
            dragId === t.id && "opacity-40",
            dropId === t.id && "ring-1 ring-ink/50",
          )}
        >
          <span title={draggable ? "Drag to set the order the clock takes these in" : undefined}
            data-grip={draggable ? t.id : undefined}
            onPointerDown={draggable && !isEditing ? (e) => { if (e.button === 0) { e.preventDefault(); setDragId(t.id); } } : undefined}
            className={clsx("-ml-1 flex h-full w-3 flex-none touch-none items-center text-faint",
              draggable ? "cursor-grab opacity-0 group-hover:opacity-100" : "opacity-0", dragId === t.id && "opacity-100")}>
            <Icon.Grip size={12} />
          </span>
          <Check checked={t.completed} onChange={() => updateTask(t.id, { completed: !t.completed })}
            label={t.completed ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`} />
          {t.color && <span className="h-3.5 w-[3px] flex-none rounded-full" style={{ backgroundColor: t.color }} aria-hidden />}

          {isEditing ? (
            <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={onEditKey}
              onBlur={saveEdit} aria-label="Task title" className="field h-8 flex-1" />
          ) : (
            <button onClick={() => setActiveId(t.id)} onDoubleClick={() => { setEditingId(t.id); setEditTitle(t.title); }}
              title="Click to focus on this · double-click to rename"
              aria-pressed={isActive}
              className={clsx("flex min-w-0 flex-1 items-baseline gap-2 text-left text-sm",
                t.completed ? "text-faint line-through" : "text-ink")}>
              <span className="truncate">{t.title || "Untitled"}</span>
              {time && <span className="num flex-none text-xs text-faint">{time}</span>}
            </button>
          )}

          {isActive && !t.completed && (
            <span className="flex flex-none items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-hue" aria-hidden />Focusing
            </span>
          )}
          <PomoCount task={t} onChange={(n) => updateTask(t.id, { estPomos: n })} />
          <button className={clsx("btn-icon h-7 w-7 flex-none", open && "bg-ground/60 text-ink",
              !open && !t.notes?.trim() && "opacity-0 group-hover:opacity-100 focus:opacity-100")}
            onClick={() => onOpenNotes(open ? null : t.id)} aria-expanded={open}
            aria-label={open ? `Close notes for “${t.title}”` : `Open notes for “${t.title}”`}
            title={t.notes?.trim() ? "Notes" : "Add notes"}>
            <Icon.Notes size={14} />
          </button>
          <button className="btn-icon h-7 w-7 flex-none opacity-0 group-hover:opacity-100 focus:opacity-100"
            onClick={() => { removeTask(t.id); if (open) onOpenNotes(null); }} aria-label={`Delete “${t.title}”`}>
            <Icon.Close size={14} />
          </button>
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="panel-title">{title}</h2>
        <span className="num text-xs text-muted">
          {visible.length ? `${openTasks.length} open · ${done.length} done` : "0 tasks"}
        </span>
      </div>

      <form onSubmit={onAdd} className="mt-3 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task"
          aria-label={`Add a task to ${title}`} className="field flex-1" />
        <label className="flex h-10 flex-none items-center gap-1.5 rounded-[10px] border border-control px-2.5 text-xs text-muted">
          <input type="number" min={1} max={20} value={est} onChange={(e) => setEst(parseInt(e.target.value, 10) || 1)}
            className="num w-6 bg-transparent text-center text-sm text-ink focus:outline-none" aria-label="Estimated pomodoros" />
          pom.
        </label>
        <button type="submit" className="btn-outline h-10 w-10 flex-none px-0" aria-label="Add task"><Icon.Plus /></button>
      </form>

      <ul ref={listRef} className="mt-2 flex-1">
        {visible.length === 0 && (
          <li className="mt-1 rounded-xl border border-dashed border-control px-3 py-2.5 text-sm text-muted">{emptyHint}</li>
        )}
        {openTasks.map((t) => row(t, !sort))}
        {done.length > 0 && openTasks.length > 0 && <li className="px-2 pb-1 pt-3 text-xs text-faint">Done</li>}
        {done.map((t) => row(t, false))}
      </ul>
      {visible.length > 0 && (
        <p className="num mt-3 flex justify-between border-t border-line pt-3 text-xs text-muted">
          <span>Pomodoros</span>
          <span><span className="text-ink">{visible.reduce((n, t) => n + t.donePomos, 0)}</span> done of {visible.reduce((n, t) => n + t.estPomos, 0)} estimated</span>
        </p>
      )}
    </>
  );
}

/** "2/4" — done in ink, estimate in grey; click to raise the estimate, right-click to lower. */
function PomoCount({ task, onChange }: { task: Task; onChange: (n: number) => void }) {
  return (
    <button className="num flex-none rounded-full px-2 py-0.5 text-sm hover:bg-ground/60"
      onClick={() => onChange(Math.min(20, task.estPomos + 1))}
      onContextMenu={(e) => { e.preventDefault(); onChange(Math.max(1, task.estPomos - 1)); }}
      title="Pomodoros done / estimated · click +1, right-click −1"
      aria-label={`${task.donePomos} of ${task.estPomos} pomodoros. Raise estimate`}>
      <span className="text-ink">{task.donePomos}</span>
      <span className="text-faint">/{task.estPomos}</span>
    </button>
  );
}
