/**
 * Session log: one entry per finished (or cut-short) phase. Feeds the Day strip
 * and the "Today so far" figures. Stored locally; entries older than 60 days
 * are pruned on load.
 */
import { useSyncExternalStore } from "react";
import type { Phase } from "./types";
import { toISODate } from "./dates";

export interface SessionEntry {
  id: string;
  phase: Exclude<Phase, "Idle">;
  /** epoch ms when the phase ended */
  endedAt: number;
  /** seconds actually spent in it */
  secs: number;
  taskId?: string | null;
  skipped: boolean;
}

const KEY = "pokusfocus.sessions.v1";
const KEEP_DAYS = 60;

function load(): SessionEntry[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SessionEntry[];
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    return all.filter((e) => e.endedAt >= cutoff);
  } catch {
    return [];
  }
}

let entries: SessionEntry[] = load();
const subs = new Set<() => void>();

function commit(next: SessionEntry[]) {
  entries = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage full or blocked: keep the in-memory log */
  }
  subs.forEach((fn) => fn());
}

export function logSession(e: Omit<SessionEntry, "id" | "endedAt"> & { endedAt?: number }) {
  if (e.secs <= 0) return;
  commit([...entries, { id: crypto.randomUUID(), endedAt: Date.now(), ...e }]);
}

/** Replaces the whole log (demo seeding only). */
export function replaceLog(next: SessionEntry[]) {
  commit(next);
}

export function useSessions(): SessionEntry[] {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => entries,
  );
}

export function sessionsOn(list: SessionEntry[], dayISO: string): SessionEntry[] {
  return list.filter((e) => toISODate(new Date(e.endedAt)) === dayISO);
}

export interface DayTotals {
  focusSecs: number;
  sessionsFinished: number;
  breaksTaken: number;
  breaksDue: number;
  waterBreaks: number;
}

export function totals(day: SessionEntry[]): DayTotals {
  const focus = day.filter((e) => e.phase === "Work");
  const breaks = day.filter((e) => e.phase === "ShortBreak" || e.phase === "LongBreak");
  return {
    focusSecs: focus.reduce((s, e) => s + e.secs, 0),
    sessionsFinished: focus.filter((e) => !e.skipped).length,
    breaksTaken: breaks.filter((e) => !e.skipped).length,
    breaksDue: breaks.length,
    waterBreaks: day.filter((e) => e.phase === "MicroBreak").length,
  };
}
