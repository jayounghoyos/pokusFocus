import {
  createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef,
} from "react";
import { pendingMaterializations } from "./scheduling";

export interface LegacyChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Recurrence {
  /** Monday-indexed weekdays this task repeats on: 0=Mon … 6=Sun. */
  weekdays: number[];
}

export interface Task {
  id: string;
  title: string;
  estPomos: number;
  donePomos: number;
  completed: boolean;
  notes?: string;
  /** ISO yyyy-mm-dd. Absent = backlog (no scheduled day). */
  date?: string;
  /** Minutes from midnight. Absent = untimed / all-day for its date. */
  startMin?: number;
  endMin?: number;
  /** Accent color hex for the calendar block. */
  color?: string;
  /** If set, this is a recurring template that materializes per week. */
  recur?: Recurrence;
  /** For a materialized instance, the id of the recurring template it came from. */
  templateId?: string;
  /** When true, the block is drawn full-width over others instead of being
   *  packed side-by-side. Off by default so overlapping tasks stay readable. */
  allowOverlap?: boolean;
  /** Legacy field — migrated into notes as markdown checkboxes. */
  checklist?: LegacyChecklistItem[];
}

const STORAGE_KEY = "pokusfocus.tasks.v1";
const ACTIVE_KEY = "pokusfocus.tasks.active.v1";
const MATERIALIZED_KEY = "pokusfocus.materialized.v1";

function loadMaterialized(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MATERIALIZED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export const TASK_COLORS = [
  "#e0a042", // amber (calendar default)
  "#3b82f6", // blue
  "#10b981", // emerald
  "#a855f7", // violet
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
  "#a1a1aa", // zinc
];

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

export interface TasksApi {
  tasks: Task[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  addTask: (partial: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  removeWhere: (pred: (t: Task) => boolean) => void;
  reorder: (fromId: string, toId: string) => void;
  incrementActivePomo: (autoCheck: boolean) => void;
  /** Materialize today's recurring-template instances from the given snapshot
   *  (idempotent). Pass the current `tasks` so it never reads stale state. */
  materialize: (current: Task[]) => void;
}

const TasksContext = createContext<TasksApi | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [activeId, setActiveIdState] = useState<string | null>(loadActiveId);
  const materializedRef = useRef<Set<string>>(loadMaterialized());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeId]);

  const setActiveId = useCallback((id: string | null) => setActiveIdState(id), []);

  const addTask = useCallback<TasksApi["addTask"]>((partial) => {
    const task: Task = {
      id: crypto.randomUUID(),
      title: partial.title.trim(),
      estPomos: Math.max(1, partial.estPomos ?? 1),
      donePomos: partial.donePomos ?? 0,
      completed: partial.completed ?? false,
      notes: partial.notes,
      date: partial.date,
      startMin: partial.startMin,
      endMin: partial.endMin,
      color: partial.color,
      recur: partial.recur,
      templateId: partial.templateId,
      allowOverlap: partial.allowOverlap,
    };
    setTasks((p) => [...p, task]);
    setActiveIdState((cur) => cur ?? task.id);
    return task;
  }, []);

  const updateTask = useCallback<TasksApi["updateTask"]>((id, patch) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTask = useCallback<TasksApi["removeTask"]>((id) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveIdState((cur) => {
        if (cur !== id) return cur;
        const fallback = next.find((t) => !t.completed);
        return fallback?.id ?? null;
      });
      return next;
    });
  }, []);

  const removeWhere = useCallback<TasksApi["removeWhere"]>((pred) => {
    setTasks((prev) => {
      const next = prev.filter((t) => !pred(t));
      setActiveIdState((cur) =>
        cur && next.some((t) => t.id === cur) ? cur : next.find((t) => !t.completed)?.id ?? null,
      );
      return next;
    });
  }, []);

  const reorder = useCallback<TasksApi["reorder"]>((fromId, toId) => {
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
  }, []);

  const incrementActivePomo = useCallback<TasksApi["incrementActivePomo"]>(
    (autoCheck) => {
      setActiveIdState((curActive) => {
        if (!curActive) return curActive;
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === curActive ? { ...t, donePomos: t.donePomos + 1 } : t,
          );
          const active = updated.find((t) => t.id === curActive);
          if (autoCheck && active && active.donePomos >= active.estPomos) {
            const checked = updated.map((t) =>
              t.id === curActive ? { ...t, completed: true } : t,
            );
            const next = checked.find((t) => !t.completed && t.id !== curActive);
            queueMicrotask(() => setActiveIdState(next?.id ?? null));
            return checked;
          }
          return updated;
        });
        return curActive;
      });
    },
    [],
  );

  const materialize = useCallback<TasksApi["materialize"]>((current) => {
    const pending = pendingMaterializations(current, materializedRef.current);
    if (pending.length === 0) return;
    for (const p of pending) materializedRef.current.add(p.key);
    localStorage.setItem(
      MATERIALIZED_KEY,
      JSON.stringify([...materializedRef.current]),
    );
    setTasks((prev) => [
      ...prev,
      ...pending.map((p) => ({
        id: crypto.randomUUID(),
        title: p.partial.title ?? "",
        estPomos: Math.max(1, p.partial.estPomos ?? 1),
        donePomos: 0,
        completed: false,
        notes: p.partial.notes,
        date: p.partial.date,
        startMin: p.partial.startMin,
        endMin: p.partial.endMin,
        color: p.partial.color,
        templateId: p.partial.templateId,
      })),
    ]);
  }, []);

  const api: TasksApi = {
    tasks, activeId, setActiveId,
    addTask, updateTask, removeTask, removeWhere, reorder, incrementActivePomo,
    materialize,
  };

  return <TasksContext.Provider value={api}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksApi {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
