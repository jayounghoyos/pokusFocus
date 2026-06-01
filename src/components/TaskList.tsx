import { useState, FormEvent, KeyboardEvent } from "react";
import clsx from "clsx";
import { Check } from "./Check";
import { NotesEditor } from "./NotesEditor";
import { Task, useTasks } from "../lib/tasks";
import { minToLabel } from "../lib/dates";

interface Props {
  /** Which tasks this list shows. Defaults to all. */
  filter?: (t: Task) => boolean;
  /** Optional ordering applied to visible tasks (e.g. by start time). */
  sort?: (a: Task, b: Task) => number;
  /** Shown when the form adds a task — lets Today inject today's date. */
  newTaskDefaults?: () => Partial<Task>;
  emptyHint?: string;
}

export function TaskList({ filter, sort, newTaskDefaults, emptyHint }: Props) {
  const { tasks, activeId, setActiveId, addTask, updateTask, removeTask, reorder } =
    useTasks();

  const [title, setTitle] = useState("");
  const [est, setEst] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEst, setEditEst] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const filtered = filter ? tasks.filter(filter) : tasks;
  const visible = sort ? [...filtered].sort(sort) : filtered;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addTask({
      title: trimmed,
      estPomos: Math.max(1, est | 0),
      ...(newTaskDefaults ? newTaskDefaults() : {}),
    });
    setTitle("");
    setEst(1);
  };

  const startEdit = (t: Task) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditEst(t.estPomos);
  };
  const saveEdit = () => {
    if (!editingId) return;
    updateTask(editingId, {
      title: editTitle.trim() || undefined,
      estPomos: Math.max(1, Math.min(99, editEst | 0)),
    });
    setEditingId(null);
  };
  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditingId(null);
  };

  const pending = visible.filter((t) => !t.completed);
  const done = visible.filter((t) => t.completed);

  const row = (t: Task, draggable: boolean) => (
    <TaskRow
      key={t.id}
      task={t}
      isActive={t.id === activeId}
      isExpanded={expandedId === t.id}
      isEditing={editingId === t.id}
      editTitle={editTitle}
      setEditTitle={setEditTitle}
      editEst={editEst}
      setEditEst={setEditEst}
      onEditKey={onEditKey}
      onEditSave={saveEdit}
      onStartEdit={() => startEdit(t)}
      onToggle={() => updateTask(t.id, { completed: !t.completed })}
      onRemove={() => {
        removeTask(t.id);
        if (expandedId === t.id) setExpandedId(null);
      }}
      onActivate={() => setActiveId(t.id)}
      onToggleExpand={() => setExpandedId((c) => (c === t.id ? null : t.id))}
      onNotesChange={(v) => updateTask(t.id, { notes: v })}
      isDragging={dragId === t.id}
      isDropTarget={dropId === t.id && dragId !== t.id}
      onDragStart={() => setDragId(t.id)}
      onDragOver={() => setDropId(t.id)}
      onDragEnd={() => {
        setDragId(null);
        setDropId(null);
      }}
      onDrop={() => {
        if (dragId) reorder(dragId, t.id);
        setDragId(null);
        setDropId(null);
      }}
      draggable={draggable}
    />
  );

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <form onSubmit={onAdd} className="flex gap-2 mb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-md
                     px-3 py-2 text-base placeholder:text-zinc-500
                     focus:outline-none focus:border-zinc-600"
        />
        <input
          type="number"
          min={1}
          max={20}
          value={est}
          onChange={(e) => setEst(parseInt(e.target.value, 10) || 1)}
          className="w-16 bg-zinc-900/60 border border-zinc-800 rounded-md
                     px-2 py-2 text-base text-center tabular-nums
                     focus:outline-none focus:border-zinc-600"
          aria-label="Estimated pomodoros"
        />
        <button type="submit" className="btn-primary">+</button>
      </form>

      {visible.length === 0 && emptyHint && (
        <p className="text-center text-sm text-zinc-600 py-6">{emptyHint}</p>
      )}

      <ul className="space-y-1">
        {pending.map((t) => row(t, true))}
        {done.length > 0 && pending.length > 0 && (
          <li className="pt-2 text-[10px] uppercase tracking-wider text-zinc-600">done</li>
        )}
        {done.map((t) => row(t, false))}
      </ul>
    </div>
  );
}

interface RowProps {
  task: Task;
  isActive: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (s: string) => void;
  editEst: number;
  setEditEst: (n: number) => void;
  onEditKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  onEditSave: () => void;
  onStartEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onActivate: () => void;
  onToggleExpand: () => void;
  onNotesChange: (v: string) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  draggable?: boolean;
}

function TaskRow(props: RowProps) {
  const {
    task, isActive, isExpanded, isEditing,
    editTitle, setEditTitle, editEst, setEditEst,
    onEditKey, onEditSave, onStartEdit, onToggle, onRemove, onActivate,
    onToggleExpand, onNotesChange,
    isDragging, isDropTarget, onDragStart, onDragOver, onDragEnd, onDrop,
    draggable = true,
  } = props;

  const timeLabel =
    task.startMin != null
      ? task.endMin != null
        ? `${minToLabel(task.startMin)}–${minToLabel(task.endMin)}`
        : minToLabel(task.startMin)
      : null;

  return (
    <li>
      <div
        draggable={draggable && !isEditing}
        onDragStart={(e) => {
          if (isEditing) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver();
        }}
        onDragEnd={onDragEnd}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
        className={clsx(
          "group flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors duration-200",
          isActive
            ? "border-focus-work/40 bg-focus-work/5"
            : "border-transparent hover:bg-zinc-900/50",
          task.completed && "opacity-50",
          isDragging && "opacity-30",
          isDropTarget && "border-zinc-500",
        )}
      >
        <span
          className={clsx(
            "text-zinc-700 text-xs leading-none select-none",
            draggable && !isEditing
              ? "cursor-grab active:cursor-grabbing group-hover:text-zinc-500"
              : "opacity-0",
          )}
          aria-hidden
        >
          ⋮⋮
        </span>
        <button
          onClick={onToggleExpand}
          className="text-zinc-600 hover:text-zinc-300 text-xs leading-none transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          title="Notes"
        >
          {isExpanded ? "▼" : "▶"}
        </button>
        {task.color && (
          <span
            className="h-3 w-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: task.color }}
            aria-hidden
          />
        )}
        <Check
          checked={task.completed}
          onChange={onToggle}
          size={18}
          ariaLabel={task.completed ? "Mark task incomplete" : "Mark task done"}
        />
        {isEditing ? (
          <>
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={onEditKey}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-base
                         focus:outline-none focus:border-zinc-500"
            />
            <input
              type="number"
              min={1}
              max={99}
              value={editEst}
              onChange={(e) => setEditEst(Math.max(1, parseInt(e.target.value, 10) || 1))}
              onKeyDown={onEditKey}
              className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-base text-center tabular-nums
                         focus:outline-none focus:border-zinc-500"
              aria-label="Estimated pomodoros"
            />
            <button onClick={onEditSave} className="text-zinc-400 hover:text-zinc-100 text-xs px-2">
              save
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onActivate}
              onDoubleClick={onStartEdit}
              className={clsx(
                "flex-1 text-left text-base truncate transition-colors",
                task.completed && "line-through",
                isActive && "text-zinc-100",
                !isActive && !task.completed && "text-zinc-300 hover:text-zinc-100",
              )}
              title="Click to activate · Double-click to edit"
            >
              {task.title}
              {timeLabel && (
                <span className="ml-2 text-xs text-zinc-500 tabular-nums">{timeLabel}</span>
              )}
            </button>
            <button
              onClick={onStartEdit}
              className="text-sm tabular-nums text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Edit estimate"
            >
              {task.donePomos}/{task.estPomos}
            </button>
          </>
        )}
        <button
          onClick={onRemove}
          className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
          aria-label="Remove task"
        >
          ×
        </button>
      </div>

      {isExpanded && (
        <div className="ml-12 mt-1.5 mr-2 mb-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 overflow-hidden animate-fade-in">
          <NotesEditor value={task.notes ?? ""} onChange={onNotesChange} />
        </div>
      )}
    </li>
  );
}
