/** Display formatting. Every figure on screen goes through one of these. */

/** 1500 → "25:00" */
export function clock(totalSecs: number): string {
  const s = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

/** 7500 → "2 h 5 m", 900 → "15 m", 0 → "0 m" */
export function duration(totalSecs: number): string {
  const mins = Math.round(totalSecs / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} m`;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** "1 pomodoro" / "3 pomodoros" */
export function plural(n: number, noun: string, many = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : many}`;
}

/** Monday, November 2 */
export function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
