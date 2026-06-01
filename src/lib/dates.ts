/** Lightweight date helpers — Monday-start weeks, ISO yyyy-mm-dd keys. No deps. */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LABELS_FULL = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

/** 0 = Monday … 6 = Sunday (JS getDay is 0=Sun, we shift). */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - mondayIndex(out));
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** Local-time ISO date key (not UTC) so day boundaries match the user's clock. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function isTodayISO(iso: string): boolean {
  return iso === todayISO();
}

export function isPastISO(iso: string): boolean {
  return iso < todayISO();
}

/** Returns the 7 Date objects (Mon..Sun) of the week containing `d`. */
export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "Mar 25" style short label. */
export function shortLabel(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/** Minutes-from-midnight → "8:00 AM" / "13:30" style. Defaults to 12h. */
export function minToLabel(min: number, h24 = false): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h24) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Snap a pixel offset within a day column to the nearest `stepMin` slot. */
export function snapMinutes(min: number, stepMin = 15): number {
  return Math.max(0, Math.min(24 * 60, Math.round(min / stepMin) * stepMin));
}
