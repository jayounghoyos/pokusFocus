import { useEffect, useState, FormEvent, KeyboardEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import clsx from "clsx";
import { Check } from "./Check";
import { NotesEditor } from "./NotesEditor";

interface LegacyChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface Task {
  id: string;
  title: string;
  estPomos: number;
  donePomos: number;
  completed: boolean;
  notes?: string;
  /** Legacy field — migrated into notes as markdown checkboxes. */
  checklist?: LegacyChecklistItem[];
}

interface PhaseEndEvent {
  ended: "Work" | "ShortBreak" | "LongBreak" | "Idle" | "MicroBreak";
  started: "Work" | "ShortBreak" | "LongBreak" | "Idle" | "MicroBreak";
  is_postponed: boolean;
}

const STORAGE_KEY = "pokusfocus.tasks.v1";
const ACTIVE_KEY = "pokusfocus.tasks.active.v1";

function migrateTask(t: Task): Task {
  if (!t.checklist || t.checklist.length === 0) return t;
  const md = t.checklist
    .map((it) => `- [${it.done ? "x" : " "}] ${it.text}`)
    .join("\n");
  const combined = t.notes ? `${t.notes.replace(/\s+$/, "")}\n\n${md}` : md;
  return { ...t, notes: combined, checklist: undefined };
}

function loadTasks(): Task[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Task[];
    return raw.map(migrateTask);
  } catch {
    return [];
  }
}

function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function TaskList({ autoCheck }: { autoCheck: boolean }) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [activeId, setActiveId] = useState<string | null>(loadActiveId);
  const [title, setTitle] = useState("");
  const [est, setEst] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEst, setEditEst] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeId]);

  useEffect(() => {
    const unlisten = listen<PhaseEndEvent>("scheduler://phase-end", (e) => {
      if (e.payload.ended !== "Work" || e.payload.is_postponed || !activeId) return;
      setTasks((prev) => {
        const updated = prev.map((t) =>
          t.id === activeId ? { ...t, donePomos: t.donePomos + 1 } : t,
        );
        const active = updated.find((t) => t.id === activeId);
        if (autoCheck && active && active.donePomos >= active.estPomos) {
          const checked = updated.map((t) =>
            t.id === activeId ? { ...t, completed: true } : t,
          );
          const next = checked.find((t) => !t.completed && t.id !== activeId);
          setActiveId(next?.id ?? null);
          return checked;
        }
        return updated;
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [activeId, autoCheck]);

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const task: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      estPomos: Math.max(1, est | 0),
      donePomos: 0,
      completed: false,
    };
    setTasks((p) => [...p, task]);
    if (!activeId) setActiveId(task.id);
    setTitle("");
    setEst(1);
  };

  const toggleDone = (id: string) =>
    setTasks((p) =>
      p.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );

  const removeTask = (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    if (activeId === id) {
      const next = tasks.find((t) => t.id !== id && !t.completed);
      setActiveId(next?.id ?? null);
    }
    if (expandedId === id) setExpandedId(null);
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditEst(task.estPomos);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const trimmed = editTitle.trim();
    const nextEst = Math.max(1, Math.min(99, editEst | 0));
    setTasks((p) =>
      p.map((t) =>
        t.id === editingId
          ? { ...t, title: trimmed || t.title, estPomos: nextEst }
          : t,
      ),
    );
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  const moveTask = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setTasks((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === fromId);
      const toIdx = prev.findIndex((t) => t.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const updateNotes = (id: string, notes: string) =>
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, notes } : t)));

  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const renderRow = (t: Task, draggable: boolean) => (
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
      onToggle={() => toggleDone(t.id)}
      onRemove={() => removeTask(t.id)}
      onActivate={() => setActiveId(t.id)}
      onToggleExpand={() =>
        setExpandedId((cur) => (cur === t.id ? null : t.id))
      }
      onNotesChange={(v) => updateNotes(t.id, v)}
      isDragging={dragId === t.id}
      isDropTarget={dropId === t.id && dragId !== t.id}
      onDragStart={() => setDragId(t.id)}
      onDragOver={() => setDropId(t.id)}
      onDragEnd={() => {
        setDragId(null);
        setDropId(null);
      }}
      onDrop={() => {
        if (dragId) moveTask(dragId, t.id);
        setDragId(null);
        setDropId(null);
      }}
      draggable={draggable}
    />
  );

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <form onSubmit={addTask} className="flex gap-2 mb-3">
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

      <ul className="space-y-1">
        {pending.map((t) => renderRow(t, true))}
        {done.length > 0 && pending.length > 0 && (
          <li className="pt-2 text-[10px] uppercase tracking-wider text-zinc-600">
            done
          </li>
        )}
        {done.map((t) => renderRow(t, false))}
      </ul>
    </div>
  );
}

interface TaskRowProps {
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

function TaskRow(props: TaskRowProps) {
  const {
    task, isActive, isExpanded, isEditing,
    editTitle, setEditTitle, editEst, setEditEst,
    onEditKey, onEditSave, onStartEdit, onToggle, onRemove, onActivate,
    onToggleExpand, onNotesChange,
    isDragging, isDropTarget, onDragStart, onDragOver, onDragEnd, onDrop,
    draggable = true,
  } = props;

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
              onChange={(e) =>
                setEditEst(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              onKeyDown={onEditKey}
              className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-base text-center tabular-nums
                         focus:outline-none focus:border-zinc-500"
              aria-label="Estimated pomodoros"
            />
            <button
              onClick={onEditSave}
              className="text-zinc-400 hover:text-zinc-100 text-xs px-2"
            >
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
              title="Click to activate · Double-click to edit · Drag to reorder"
            >
              {task.title}
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
          <NotesEditor
            value={task.notes ?? ""}
            onChange={onNotesChange}
          />
        </div>
      )}
    </li>
  );
}
