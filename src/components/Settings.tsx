import { ReactNode, useEffect, useState } from "react";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import clsx from "clsx";
import { SchedulerConfig, DEFAULT_CONFIG } from "../lib/config";
import { Theme, THEMES } from "../lib/theme";
import { ChimeStyle, playChime } from "../lib/sound";
import { useTasks } from "../lib/tasks";

const CHIME_OPTIONS: { value: ChimeStyle; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "bell", label: "Bell" },
  { value: "digital", label: "Digital" },
  { value: "wind", label: "Wind" },
];

interface Props {
  config: SchedulerConfig;
  onChange: (next: SchedulerConfig) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onClose: () => void;
}

export function Settings({ config, onChange, theme, onThemeChange, onClose }: Props) {
  const update = <K extends keyof SchedulerConfig>(
    key: K,
    value: SchedulerConfig[K],
  ) => onChange({ ...config, [key]: value });

  const restore = () => onChange({ ...DEFAULT_CONFIG });

  const [autostart, setAutostart] = useState(false);
  useEffect(() => {
    isAutostartEnabled().then(setAutostart).catch(() => {});
  }, []);
  const toggleAutostart = async (v: boolean) => {
    try {
      if (v) await enableAutostart();
      else await disableAutostart();
      setAutostart(v);
    } catch (e) {
      console.error("autostart toggle failed", e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-950">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-300">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4 space-y-6">
          <Section title="Timer (minutes)">
            <NumberRow
              label="Focus"
              value={config.work_secs / 60}
              min={1}
              max={180}
              onChange={(v) => update("work_secs", v * 60)}
            />
            <NumberRow
              label="Short break"
              value={config.short_break_secs / 60}
              min={1}
              max={60}
              onChange={(v) => update("short_break_secs", v * 60)}
            />
            <NumberRow
              label="Long break"
              value={config.long_break_secs / 60}
              min={1}
              max={60}
              onChange={(v) => update("long_break_secs", v * 60)}
            />
            <NumberRow
              label="Long break every (cycles)"
              value={config.long_break_every}
              min={1}
              max={12}
              onChange={(v) => update("long_break_every", v)}
            />
            <ToggleRow
              label="Auto-advance to next phase"
              checked={config.auto_advance}
              onChange={(v) => update("auto_advance", v)}
            />
            <ToggleRow
              label="Strict mode (can't skip breaks)"
              checked={config.strict_mode}
              onChange={(v) => update("strict_mode", v)}
            />
            <NumberRow
              label="Postpone duration (minutes)"
              value={Math.round(config.postpone_secs / 60)}
              min={1}
              max={30}
              onChange={(v) => update("postpone_secs", v * 60)}
            />
          </Section>

          <Section title="Micro breaks (Stretchly-style)">
            <ToggleRow
              label="Enable micro breaks"
              checked={config.micro_break_enabled}
              onChange={(v) => update("micro_break_enabled", v)}
            />
            <NumberRow
              label="Every (minutes)"
              value={config.micro_break_interval_secs / 60}
              min={1}
              max={60}
              step={1}
              disabled={!config.micro_break_enabled}
              onChange={(v) => update("micro_break_interval_secs", v * 60)}
            />
            <NumberRow
              label="Duration (seconds)"
              value={config.micro_break_duration_secs}
              min={5}
              max={120}
              step={5}
              disabled={!config.micro_break_enabled}
              onChange={(v) => update("micro_break_duration_secs", v)}
            />
          </Section>

          <Section title="Sound">
            <ToggleRow
              label="Play chime at phase change"
              checked={config.sound_enabled}
              onChange={(v) => update("sound_enabled", v)}
            />
            <SelectRow
              label="Chime"
              value={config.chime_style}
              options={CHIME_OPTIONS}
              disabled={!config.sound_enabled}
              onChange={(v) => update("chime_style", v as ChimeStyle)}
            />
            <NumberRow
              label="Volume (%)"
              value={Math.round(config.chime_volume * 100)}
              min={0}
              max={100}
              step={10}
              disabled={!config.sound_enabled}
              onChange={(v) => update("chime_volume", v / 100)}
            />
            <NumberRow
              label="Repeat"
              value={config.chime_repeat}
              min={1}
              max={5}
              disabled={!config.sound_enabled}
              onChange={(v) => update("chime_repeat", v)}
            />
            <div className="pt-1 flex justify-end">
              <button
                className="btn-ghost text-xs"
                disabled={!config.sound_enabled}
                onClick={() =>
                  playChime({
                    style: config.chime_style,
                    volume: config.chime_volume,
                    repeat: config.chime_repeat,
                  })
                }
              >
                Test sound
              </button>
            </div>
          </Section>

          <Section title="Tasks">
            <ToggleRow
              label="Auto-check completed tasks"
              checked={config.auto_check_tasks}
              onChange={(v) => update("auto_check_tasks", v)}
            />
            <TaskCleanup />
          </Section>

          <Section title="Warnings">
            <ToggleRow
              label="Notify before break"
              checked={config.pre_break_warning_enabled}
              onChange={(v) => update("pre_break_warning_enabled", v)}
            />
            <NumberRow
              label="Warn N seconds before"
              value={config.pre_break_warning_secs}
              min={5}
              max={300}
              step={5}
              disabled={!config.pre_break_warning_enabled}
              onChange={(v) => update("pre_break_warning_secs", v)}
            />
          </Section>

          <Section title="System">
            <ToggleRow
              label="Start at login (minimized to tray)"
              checked={autostart}
              onChange={toggleAutostart}
            />
          </Section>

          <Section title="Theme">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-300">Accent palette</span>
              <div className="flex gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onThemeChange(t.key)}
                    aria-label={t.label}
                    title={t.label}
                    className={clsx(
                      "h-6 w-6 rounded-full border transition-all",
                      theme === t.key
                        ? "border-zinc-100 scale-110"
                        : "border-zinc-700 hover:border-zinc-400",
                    )}
                    style={{ backgroundColor: t.swatch }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-600 pt-1">
              Current: <span className="text-zinc-400">{THEMES.find((t) => t.key === theme)?.label}</span>
            </p>
          </Section>

          <Section title="Keyboard shortcuts">
            <ul className="space-y-1.5">
              <Shortcut keys={["Space"]}             action="Start / Pause" />
              <Shortcut keys={["Ctrl", "N"]}         action="Skip phase" />
              <Shortcut keys={["Ctrl", "R"]}         action="Reset" />
              <Shortcut keys={["Esc"]}               action="Skip break (overlay)" />
              <Shortcut keys={["P"]}                 action="Postpone break (overlay)" />
              <Shortcut keys={["Enter"]}             action="Save edit (tasks)" />
              <Shortcut keys={["Esc"]}               action="Cancel edit (tasks)" />
            </ul>
          </Section>
        </div>

        <footer className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 sticky bottom-0 bg-zinc-950">
          <button onClick={restore} className="btn-ghost text-xs">
            Restore defaults
          </button>
          <span className="text-xs text-zinc-600">Changes save automatically</span>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function NumberRow({
  label, value, min, max, step = 1, disabled, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const dec = () => onChange(clamp(value - step));
  const inc = () => onChange(clamp(value + step));

  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex items-stretch h-8 rounded-md border border-zinc-800 overflow-hidden bg-zinc-900/40">
        <button
          type="button"
          onClick={dec}
          disabled={disabled || value <= min}
          className="px-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100
                     disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed
                     transition-colors text-sm select-none"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className="w-12 bg-transparent text-sm text-center tabular-nums
                     focus:outline-none disabled:cursor-not-allowed
                     [appearance:textfield]"
        />
        <button
          type="button"
          onClick={inc}
          disabled={disabled || value >= max}
          className="px-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100
                     disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed
                     transition-colors text-sm select-none"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </label>
  );
}

function TaskCleanup() {
  const { tasks, removeWhere } = useTasks();
  const [confirmAll, setConfirmAll] = useState(false);
  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button
        className="btn-ghost text-xs border border-zinc-800"
        disabled={doneCount === 0}
        onClick={() => removeWhere((t) => t.completed)}
      >
        Clear completed{doneCount > 0 && ` (${doneCount})`}
      </button>
      {!confirmAll ? (
        <button
          className="btn-ghost text-xs border border-zinc-800 text-red-400/80"
          disabled={tasks.length === 0}
          onClick={() => setConfirmAll(true)}
        >
          Clear all tasks
        </button>
      ) : (
        <span className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs border border-red-500/40 text-red-300"
            onClick={() => {
              removeWhere(() => true);
              setConfirmAll(false);
            }}
          >
            Confirm — delete {tasks.length}
          </button>
          <button className="btn-ghost text-xs" onClick={() => setConfirmAll(false)}>
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}

function Shortcut({ keys, action }: { keys: string[]; action: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-300">{action}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-zinc-600 text-xs">+</span>}
            <kbd
              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5
                         rounded border border-zinc-700 bg-zinc-900/60
                         text-[10px] font-mono text-zinc-300 leading-none
                         shadow-[inset_0_-1px_0_rgb(0_0_0/0.3)]"
            >
              {k}
            </kbd>
          </span>
        ))}
      </div>
    </li>
  );
}

function SelectRow<T extends string>({
  label, value, options, disabled, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-sm text-zinc-300">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 bg-zinc-900 border border-zinc-800 rounded-md
                   px-2 pr-7 text-sm text-zinc-200
                   focus:outline-none focus:border-zinc-600
                   disabled:cursor-not-allowed"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-zinc-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                    ${checked ? "bg-zinc-200" : "bg-zinc-800"}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-zinc-950 transition-transform
                      ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </label>
  );
}
