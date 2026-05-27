import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { ChimeStyle } from "./sound";

export interface SchedulerConfig {
  work_secs: number;
  short_break_secs: number;
  long_break_secs: number;
  long_break_every: number;
  micro_break_enabled: boolean;
  micro_break_interval_secs: number;
  micro_break_duration_secs: number;
  auto_advance: boolean;
  strict_mode: boolean;
  sound_enabled: boolean;
  auto_check_tasks: boolean;
  pre_break_warning_enabled: boolean;
  pre_break_warning_secs: number;
  /** frontend-only — Rust ignores unknown fields */
  chime_style: ChimeStyle;
  chime_volume: number;
  chime_repeat: number;
  postpone_secs: number;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  work_secs: 25 * 60,
  short_break_secs: 5 * 60,
  long_break_secs: 15 * 60,
  long_break_every: 4,
  micro_break_enabled: true,
  micro_break_interval_secs: 10 * 60,
  micro_break_duration_secs: 20,
  auto_advance: true,
  strict_mode: false,
  sound_enabled: true,
  auto_check_tasks: true,
  pre_break_warning_enabled: true,
  pre_break_warning_secs: 30,
  chime_style: "soft",
  chime_volume: 0.3,
  chime_repeat: 1,
  postpone_secs: 300,
};

const STORAGE_KEY = "pokusfocus.config.v1";

export function loadConfig(): SchedulerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function pushToBackend(config: SchedulerConfig) {
  try {
    await invoke("scheduler_update_config", { config });
  } catch (e) {
    console.error("failed to push config to backend", e);
  }
}

export function useConfig(): [
  SchedulerConfig,
  (next: SchedulerConfig | ((prev: SchedulerConfig) => SchedulerConfig)) => void,
] {
  const [config, setConfigState] = useState<SchedulerConfig>(loadConfig);

  useEffect(() => {
    pushToBackend(config);
  }, []);

  const setConfig = (
    next: SchedulerConfig | ((prev: SchedulerConfig) => SchedulerConfig),
  ) => {
    setConfigState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      pushToBackend(value);
      return value;
    });
  };

  return [config, setConfig];
}
