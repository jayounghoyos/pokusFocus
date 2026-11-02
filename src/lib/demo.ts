/**
 * Sample data for design inspection in a plain browser: open the Vite page with
 * `?demo`. Never runs inside Tauri, so the real app's data is never touched.
 * Every figure here is computed from these rows (focus totals, the ladder).
 */
import type { Task } from "./tasks";
import { replaceLog, SessionEntry } from "./history";
import { browserScheduler, inTauri } from "./ipc";
import { toISODate, weekDays } from "./dates";

export function maybeSeedDemo() {
  const params = new URLSearchParams(location.search);
  if (inTauri || !params.has("demo")) return;
  const mode = params.get("mode");
  if (mode === "light" || mode === "dark") localStorage.setItem("pokusfocus.mode.v1", mode);

  const now = new Date();
  const today = toISODate(now);
  const week = weekDays(now).map(toISODate);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Plan anchored on the current half hour so the strip always reads sensibly.
  const base = Math.min(Math.max(Math.floor(nowMin / 30) * 30, 11 * 60), 18 * 60);
  const at = (offsetMin: number) => base + offsetMin;

  const id = () => crypto.randomUUID();
  const stretchId = id();
  const writeId = id();
  const tasks: Task[] = [
    { id: id(), title: "Review PR 142, scheduler refactor", estPomos: 2, donePomos: 2, completed: true,
      date: today, startMin: at(-180), endMin: at(-120), color: "#3b82f6" },
    { id: writeId, title: "Write the v0.3 release notes", estPomos: 3, donePomos: 2, completed: false,
      date: today, startMin: at(-90), endMin: at(30), color: "#e0a042",
      notes: "## Outline\n- [x] Autostart fix\n- [x] Session log and Day strip\n- [ ] Screenshots of the new Today\n- [ ] Upgrade notes for `.deb` users" },
    { id: stretchId, title: "Stretch and a walk", estPomos: 1, donePomos: 0, completed: false,
      startMin: at(60), endMin: at(90), color: "#10b981", recur: { weekdays: [0, 1, 2, 3, 4] } },
    { id: id(), title: "Stretch and a walk", estPomos: 1, donePomos: 0, completed: false,
      date: today, startMin: at(60), endMin: at(90), color: "#10b981", templateId: stretchId },
    { id: id(), title: "Fix tray menu on GNOME 47", estPomos: 3, donePomos: 0, completed: false,
      date: today, startMin: at(120), endMin: at(210), color: "#ef4444" },
    { id: id(), title: "Reply to Ana about the Lisbon trip", estPomos: 1, donePomos: 0, completed: false },
    { id: id(), title: "Renew the pokusfocus.app domain", estPomos: 1, donePomos: 1, completed: true },
    { id: id(), title: "Sketch the weekly stats view", estPomos: 2, donePomos: 0, completed: false },
  ];
  // The rest of the week.
  week.forEach((iso, i) => {
    if (iso === today || i >= 5) return;
    const past = iso < today;
    tasks.push(
      { id: id(), title: i % 2 ? "Deep work: sync engine" : "Write tests for recurrence", estPomos: 4,
        donePomos: past ? 4 : 0, completed: past, date: iso, startMin: 9 * 60, endMin: 11 * 60, color: "#3b82f6" },
      { id: id(), title: "Inbox and reviews", estPomos: 1, donePomos: past ? 1 : 0, completed: past,
        date: iso, startMin: 15 * 60, endMin: 15 * 60 + 30, color: "#a1a1aa" },
    );
    if (past) {
      const stretchDone = { id: id(), title: "Stretch and a walk", estPomos: 1, donePomos: 1, completed: true,
        date: iso, startMin: at(60), endMin: at(90), color: "#10b981", templateId: stretchId };
      tasks.push(stretchDone);
    }
  });
  tasks.push({ id: id(), title: "Climbing", estPomos: 1, donePomos: 0, completed: false,
    date: week[5], startMin: 10 * 60, endMin: 12 * 60, color: "#14b8a6" });

  // Today's log, walked backwards from a focus session 10 m 28 s in.
  const inProgressSecs = 628;
  const pattern: [SessionEntry["phase"], number, boolean][] = [
    ["ShortBreak", 300, false], ["Work", 1500, false], ["ShortBreak", 60, true], ["Work", 1500, false],
    ["LongBreak", 900, false], ["Work", 1500, false], ["ShortBreak", 300, false], ["Work", 1500, false],
    ["ShortBreak", 300, false], ["Work", 1500, false],
  ];
  let cursor = now.getTime() - inProgressSecs * 1000;
  const log: SessionEntry[] = [];
  for (const [phase, secs, skipped] of pattern) {
    const task = phase === "Work" ? (log.filter((e) => e.phase === "Work").length < 2 ? writeId : null) : null;
    log.push({ id: id(), phase, endedAt: cursor, secs, skipped, taskId: task });
    cursor -= secs * 1000;
  }
  // Water breaks: one per 30 m of focus time, counted across sessions (oldest first).
  let acc = 0;
  for (const w of [...log].filter((e) => e.phase === "Work").sort((a, b) => a.endedAt - b.endedAt)) {
    const startMs = w.endedAt - w.secs * 1000;
    for (let t = 0; t < w.secs; t += 60) {
      acc += 60;
      if (acc >= 1800) {
        acc = 0;
        log.push({ id: id(), phase: "MicroBreak", endedAt: startMs + (t + 60) * 1000, secs: 30, skipped: false });
      }
    }
  }
  const finishedFocus = log.filter((e) => e.phase === "Work" && !e.skipped).length;

  localStorage.setItem("pokusfocus.tasks.v1", JSON.stringify(tasks));
  localStorage.setItem("pokusfocus.tasks.active.v1", writeId);
  localStorage.setItem("pokusfocus.materialized.v1", JSON.stringify([`${stretchId}|${today}`]));
  replaceLog(log.sort((a, b) => a.endedAt - b.endedAt));
  browserScheduler().seed({ phase: "Work", remaining_secs: 1500 - inProgressSecs, cycle: finishedFocus, running: true });
}
