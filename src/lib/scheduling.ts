import type { Task } from "./tasks";
import { fromISODate, mondayIndex, todayISO } from "./dates";

/** Monday-indexed weekday (0=Mon … 6=Sun) of an ISO date string. */
export function weekdayOfISO(iso: string): number {
  return mondayIndex(fromISODate(iso));
}

/** A pure recurring template: has a recurrence AND is not itself a materialized
 *  instance. (An instance carries `templateId`; marking repeat on an instance
 *  must not turn it into a self-replicating template — that caused a delete loop.) */
export function isTemplate(t: Task): boolean {
  return !!t.recur && t.recur.weekdays.length > 0 && !t.templateId;
}

/**
 * For a given ISO day, return the tasks to show: concrete instances dated that
 * day, plus projections of recurring templates whose weekday matches and which
 * haven't already been materialized for that day.
 */
export function tasksForDay(
  tasks: Task[],
  dayISO: string,
): { instances: Task[]; projections: Task[] } {
  const weekday = weekdayOfISO(dayISO);
  const instances = tasks.filter((t) => !isTemplate(t) && t.date === dayISO);
  const materializedTemplateIds = new Set(
    instances.map((t) => t.templateId).filter(Boolean) as string[],
  );
  const projections = tasks.filter(
    (t) =>
      isTemplate(t) &&
      t.recur!.weekdays.includes(weekday) &&
      !materializedTemplateIds.has(t.id),
  );
  return { instances, projections };
}

/** Key identifying "template T was materialized for day D". */
export function materializationKey(templateId: string, dayISO: string): string {
  return `${templateId}|${dayISO}`;
}

/**
 * Concrete-instance copies that should exist for today from any recurring
 * template matching today's weekday, EXCLUDING template/day pairs already in
 * `done` (the persistent register). This makes it idempotent across reloads and
 * — crucially — means deleting a materialized instance does not regenerate it,
 * because its key stays in the register. Returns partials plus their keys.
 */
export function pendingMaterializations(
  tasks: Task[],
  done: Set<string>,
): { partial: Partial<Task>; key: string }[] {
  const today = todayISO();
  const weekday = weekdayOfISO(today);
  return tasks
    .filter(
      (t) =>
        isTemplate(t) &&
        t.recur!.weekdays.includes(weekday) &&
        !done.has(materializationKey(t.id, today)),
    )
    .map((tmpl) => ({
      key: materializationKey(tmpl.id, today),
      partial: {
        title: tmpl.title,
        estPomos: tmpl.estPomos,
        notes: tmpl.notes,
        date: today,
        startMin: tmpl.startMin,
        endMin: tmpl.endMin,
        color: tmpl.color,
        templateId: tmpl.id,
      },
    }));
}

/**
 * Scheduled-for-today tasks: dated today, or past-dated and still incomplete
 * (rolled over). Templates excluded — their materialized instances carry work.
 * This is the part of Today that is *connected to the weekly calendar*.
 */
export function scheduledTodayTasks(tasks: Task[]): Task[] {
  const today = todayISO();
  return tasks.filter((t) => {
    if (isTemplate(t)) return false;
    if (!t.date) return false;
    if (t.date === today) return true;
    if (t.date < today && !t.completed) return true; // rolled over
    return false;
  });
}

/** Loose tasks with no date — the standalone quick list, like the old app.
 *  Independent of the calendar. */
export function backlogTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isTemplate(t) && !t.date);
}

/** Everything that shows in Today (scheduled + backlog) — used for the count. */
export function todayTasks(tasks: Task[]): Task[] {
  return [...scheduledTodayTasks(tasks), ...backlogTasks(tasks)];
}

/** Stable ordering for Today: timed first (by start), then untimed. */
export function orderForToday(a: Task, b: Task): number {
  const am = a.startMin ?? Infinity;
  const bm = b.startMin ?? Infinity;
  return am - bm;
}
