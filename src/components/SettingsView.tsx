import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { TopBar, LiveChip } from "../App";
import { SchedulerConfig, DEFAULT_CONFIG } from "../lib/config";
import { Appearance, GROUNDS, MODES, THEMES, activeHue, luminance, resolvedMode } from "../lib/theme";
import { ChimeStyle, playChime } from "../lib/sound";
import { useTasks } from "../lib/tasks";
import { autostart, inTauri } from "../lib/ipc";
import { duration, plural } from "../lib/format";
import { ColorPicker, Stepper, Switch } from "./ui";

const CHIMES: { value: ChimeStyle; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "bell", label: "Bell" },
  { value: "digital", label: "Digital" },
  { value: "wind", label: "Wind" },
];

interface Props {
  config: SchedulerConfig;
  onChange: (next: SchedulerConfig) => void;
  appearance: Appearance;
  onAppearanceChange: (patch: Partial<Appearance>) => void;
}

export function SettingsView({ config, onChange, appearance, onAppearanceChange }: Props) {
  const [savedAt, setSavedAt] = useState(0);
  const update = <K extends keyof SchedulerConfig>(key: K, value: SchedulerConfig[K]) => {
    onChange({ ...config, [key]: value });
    setSavedAt(Date.now());
  };
  const mins = (k: "work_secs" | "short_break_secs" | "long_break_secs" | "micro_break_interval_secs" | "postpone_secs") =>
    Math.round(config[k] / 60);

  return (
    <>
      <TopBar title="Settings" sub={<SavedStamp at={savedAt} />}>
        <LiveChip />
      </TopBar>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1152px] px-4 pb-16 sm:px-[29px]">
          <Section title="Focus cycle"
            summary={<CyclePreview config={config} />}>
            <SettingRow label="Focus">
              <Stepper label="focus length" value={mins("work_secs")} min={1} max={180} unit="m"
                onChange={(v) => update("work_secs", v * 60)} />
            </SettingRow>
            <SettingRow label="Short break">
              <Stepper label="short break length" value={mins("short_break_secs")} min={1} max={60} unit="m"
                onChange={(v) => update("short_break_secs", v * 60)} />
            </SettingRow>
            <SettingRow label="Long break">
              <Stepper label="long break length" value={mins("long_break_secs")} min={1} max={60} unit="m"
                onChange={(v) => update("long_break_secs", v * 60)} />
            </SettingRow>
            <SettingRow label="Long break after" hint="focus sessions">
              <Stepper label="sessions before a long break" value={config.long_break_every} min={1} max={12}
                onChange={(v) => update("long_break_every", v)} />
            </SettingRow>
            <SettingRow label="Start the next phase on its own" hint="Off: the clock waits for you after each phase.">
              <Switch label="Start the next phase on its own" checked={config.auto_advance} onChange={(v) => update("auto_advance", v)} />
            </SettingRow>
          </Section>

          <Section title="Breaks"
            summary={<p>{config.strict_mode
              ? "Strict: a break runs to the end. Skip and postpone are hidden."
              : `You can push a break back ${duration(config.postpone_secs)} or skip it.`}</p>}>
            <SettingRow label="Strict mode" hint="Breaks can't be skipped or postponed.">
              <Switch label="Strict mode" checked={config.strict_mode} onChange={(v) => update("strict_mode", v)} />
            </SettingRow>
            <SettingRow label="Postpone by">
              <Stepper label="postpone length" value={mins("postpone_secs")} min={1} max={30} unit="m"
                disabled={config.strict_mode} onChange={(v) => update("postpone_secs", v * 60)} />
            </SettingRow>
            <SettingRow label="Warn before a break" hint="A desktop notification.">
              <Switch label="Warn before a break" checked={config.pre_break_warning_enabled}
                onChange={(v) => update("pre_break_warning_enabled", v)} />
            </SettingRow>
            <SettingRow label="Warn this long before">
              <Stepper label="warning lead time" value={config.pre_break_warning_secs} min={5} max={300} step={5} unit="s"
                disabled={!config.pre_break_warning_enabled} onChange={(v) => update("pre_break_warning_secs", v)} />
            </SettingRow>
          </Section>

          <Section title="Water breaks"
            summary={<p>{config.micro_break_enabled
              ? `Every ${duration(config.micro_break_interval_secs)} of focus, a ${config.micro_break_duration_secs} s reminder to drink water. The count carries over between sessions. A small card in the corner, never a full screen.`
              : "Off. Focus runs uninterrupted until its break."}</p>}>
            <SettingRow label="Remind me to drink water">
              <Switch label="Remind me to drink water" checked={config.micro_break_enabled} onChange={(v) => update("micro_break_enabled", v)} />
            </SettingRow>
            <SettingRow label="Every" hint="minutes of focus time">
              <Stepper label="water break interval" value={mins("micro_break_interval_secs")} min={5} max={120} step={5} unit="m"
                disabled={!config.micro_break_enabled} onChange={(v) => update("micro_break_interval_secs", v * 60)} />
            </SettingRow>
            <SettingRow label="For">
              <Stepper label="water break length" value={config.micro_break_duration_secs} min={10} max={180} step={5} unit="s"
                disabled={!config.micro_break_enabled} onChange={(v) => update("micro_break_duration_secs", v)} />
            </SettingRow>
          </Section>

          <Section title="Sound" summary={<p>{config.sound_enabled
            ? `${CHIMES.find((c) => c.value === config.chime_style)?.label} chime at ${Math.round(config.chime_volume * 100)}%, ${plural(config.chime_repeat, "time")} at each change of phase.`
            : "Silent."}</p>}>
            <SettingRow label="Chime when a phase changes">
              <Switch label="Chime when a phase changes" checked={config.sound_enabled} onChange={(v) => update("sound_enabled", v)} />
            </SettingRow>
            <SettingRow label="Chime">
              <div className={clsx("flex gap-1 rounded-full bg-raised p-1", !config.sound_enabled && "opacity-40")} role="radiogroup" aria-label="Chime">
                {CHIMES.map((c) => (
                  <button key={c.value} role="radio" aria-checked={config.chime_style === c.value} disabled={!config.sound_enabled}
                    onClick={() => { update("chime_style", c.value); playChime({ style: c.value, volume: config.chime_volume }); }}
                    className={clsx("h-7 rounded-full px-3 text-xs transition-colors duration-150",
                      config.chime_style === c.value ? "bg-invert text-on-invert" : "text-muted hover:text-ink")}>
                    {c.label}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Volume">
              <Stepper label="volume" value={Math.round(config.chime_volume * 100)} min={0} max={100} step={10} unit="%"
                disabled={!config.sound_enabled} onChange={(v) => update("chime_volume", v / 100)} />
            </SettingRow>
            <SettingRow label="Play it">
              <div className="flex items-center gap-2">
                <Stepper label="repeat count" value={config.chime_repeat} min={1} max={5} unit="×"
                  disabled={!config.sound_enabled} onChange={(v) => update("chime_repeat", v)} />
                <button className="btn-outline" disabled={!config.sound_enabled}
                  onClick={() => playChime({ style: config.chime_style, volume: config.chime_volume, repeat: config.chime_repeat })}>
                  Test
                </button>
              </div>
            </SettingRow>
          </Section>

          <Section title="Appearance" summary={<AppearancePreview appearance={appearance} />}>
            <SettingRow label="Mode" hint={appearance.mode === "system" ? `Following your desktop: ${resolvedMode(appearance)} now.` : undefined}>
              <div className="flex gap-1 rounded-full bg-raised p-1" role="radiogroup" aria-label="Mode">
                {MODES.map((m) => (
                  <button key={m.key} role="radio" aria-checked={appearance.mode === m.key}
                    onClick={() => { onAppearanceChange({ mode: m.key }); setSavedAt(Date.now()); }}
                    className={clsx("h-7 rounded-full px-3 text-xs transition-colors duration-150",
                      appearance.mode === m.key ? "bg-invert text-on-invert" : "text-muted hover:text-ink")}>
                    {m.label}
                  </button>
                ))}
              </div>
            </SettingRow>
            <div className="border-b border-line py-3.5">
              <div className="text-sm font-medium">Focus colour</div>
              <div className="mb-3 text-xs text-muted">Marks focus time only: the clock's line, the session marks and the Day strip.</div>
              <ColorPicker label="Focus colour" value={activeHue(appearance)}
                presets={THEMES.map((t) => ({ color: t.swatch, name: t.label }))}
                onChange={(hex) => {
                  const preset = THEMES.find((t) => t.swatch.toLowerCase() === hex.toLowerCase());
                  if (preset) onAppearanceChange({ theme: preset.key });
                  else onAppearanceChange({ theme: "custom", customHue: hex });
                  setSavedAt(Date.now());
                }} />
              {resolvedMode(appearance) === "dark" && luminance(activeHue(appearance)) < 0.1 && (
                <p className="mt-2 text-xs text-warning">This colour is hard to see on a dark background. A lighter shade reads better.</p>
              )}
              {resolvedMode(appearance) === "light" && luminance(activeHue(appearance)) > 0.6 && (
                <p className="mt-2 text-xs text-warning">This colour is hard to see on a light background. A deeper shade reads better.</p>
              )}
            </div>
            <div className="py-3.5">
              <div className="text-sm font-medium">Background</div>
              <div className="mb-3 text-xs text-muted">The tone of the background behind everything.</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Background">
                {GROUNDS.map(({ key, ...tones }) => ({ key, ...tones[resolvedMode(appearance)] })).map((g) => (
                  <button key={g.key} role="radio" aria-checked={appearance.ground === g.key}
                    onClick={() => { onAppearanceChange({ ground: g.key }); setSavedAt(Date.now()); }}
                    className={clsx("flex items-center gap-2.5 rounded-xl p-2 text-left text-sm transition-colors duration-150",
                      appearance.ground === g.key ? "bg-raised text-ink" : "text-muted hover:text-ink")}>
                    <span className="flex h-8 w-10 flex-none items-end justify-end rounded-lg p-1 ring-1 ring-control" style={{ backgroundColor: g.ground }}>
                      <span className="h-4 w-6 rounded-[4px]" style={{ backgroundColor: g.surface }} />
                    </span>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Tasks" summary={<p>Finishing a task's last estimated pomodoro can tick it off and move the clock to the next open task.</p>}>
            <SettingRow label="Tick off a task when its pomodoros are done">
              <Switch label="Tick off a task when its pomodoros are done" checked={config.auto_check_tasks}
                onChange={(v) => update("auto_check_tasks", v)} />
            </SettingRow>
          </Section>

          <Section title="System" summary={<p>pokusFocus lives in the tray. Closing the window keeps the timer running; Quit is in the tray menu.</p>}>
            <AutostartRow />
          </Section>

          <Section title="Keyboard" summary={<p>Shortcuts work anywhere in the window except while typing.</p>}>
            {[
              [["Space"], "Start or pause"],
              [["Ctrl", "N"], "Skip to the next phase"],
              [["Ctrl", "R"], "Reset the cycle"],
              [["Esc"], "Skip the break (break screen)"],
              [["P"], "Postpone the break (break screen)"],
              [["Ctrl", "Enter"], "Finish editing notes"],
            ].map(([keys, label]) => (
              <SettingRow key={label as string} label={label as string}>
                <span className="flex items-center gap-1">
                  {(keys as string[]).map((k) => <kbd key={k} className="kbd">{k}</kbd>)}
                </span>
              </SettingRow>
            ))}
          </Section>

          <Section title="Reset and clean up" summary={<p>These can't be undone. Your session history is kept.</p>} last>
            <SettingRow label="Restore every setting to its default">
              <button className="btn-outline" onClick={() => { onChange({ ...DEFAULT_CONFIG }); setSavedAt(Date.now()); }}>Restore</button>
            </SettingRow>
            <TaskCleanup />
          </Section>
        </div>
      </main>
    </>
  );
}

/* ---------- layout ---------- */

function Section({ title, summary, children, last }: { title: string; summary: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <section className={clsx("grid gap-4 py-8 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] md:gap-10", !last && "border-b border-line")}
      aria-label={title}>
      <div className="md:pt-3">
        <h2 className="text-base font-medium">{title}</h2>
        <div className="mt-1 text-sm text-muted">{summary}</div>
      </div>
      <div className="rounded-2xl bg-surface px-4 py-1">{children}</div>
    </section>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SavedStamp({ at }: { at: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1600);
    return () => clearTimeout(t);
  }, [at]);
  return <span className={clsx("transition-opacity duration-300", show ? "opacity-100" : "opacity-0")} aria-live="polite">{show ? "Saved" : ""}</span>;
}

/* ---------- what each section produces ---------- */

/** One full run to the long break, drawn to scale. */
function CyclePreview({ config }: { config: SchedulerConfig }) {
  const n = Math.max(1, config.long_break_every);
  const parts: { kind: "focus" | "short" | "long"; secs: number }[] = [];
  for (let i = 0; i < n; i++) {
    parts.push({ kind: "focus", secs: config.work_secs });
    parts.push({ kind: i === n - 1 ? "long" : "short", secs: i === n - 1 ? config.long_break_secs : config.short_break_secs });
  }
  const total = parts.reduce((s, p) => s + p.secs, 0);
  const focus = n * config.work_secs;
  return (
    <div>
      <p>
        {plural(n, "focus session")} then a long break: <span className="num whitespace-nowrap text-ink">{duration(total)}</span> per cycle,{" "}
        <span className="num whitespace-nowrap text-ink">{duration(focus)}</span> of it focus.
      </p>
      <div className="mt-3 flex h-3 gap-[2px]" role="img" aria-label={`Cycle of ${duration(total)}`}>
        {parts.map((p, i) => (
          <span key={i} className={clsx("rounded-[3px]", p.kind === "focus" ? "bg-hue" : p.kind === "long" ? "bg-muted" : "bg-rest")}
            style={{ flexGrow: p.secs, flexBasis: 0 }} />
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-xs text-faint"><span>0 m</span><span>{duration(total)}</span></div>
    </div>
  );
}

function AppearancePreview({ appearance }: { appearance: Appearance }) {
  const name = appearance.theme === "custom" ? appearance.customHue : THEMES.find((t) => t.key === appearance.theme)?.label;
  const mode = resolvedMode(appearance);
  const ground = GROUNDS.find((g) => g.key === appearance.ground)?.[mode].label.toLowerCase();
  const base = mode === "dark" ? (ground === "black" ? "black" : `${ground} black`) : (ground === "white" ? "white" : `${ground} white`);
  return (
    <div>
      <p>{name} on {base}. Buttons and navigation stay {mode === "dark" ? "white on black" : "black on white"} so focus time is the only colour on screen.</p>
      <div className="mt-3 flex h-3 gap-[2px]" aria-hidden>
        <span className="w-24 rounded-[3px] bg-hue" /><span className="w-5 rounded-[3px] bg-rest" /><span className="w-24 rounded-[3px] bg-hue" />
      </div>
    </div>
  );
}

function AutostartRow() {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { autostart.isEnabled().then(setOn).catch(() => {}); }, []);
  // A dev build would register its own debug binary as the login item — the
  // binary that loads from a dev server that isn't running at boot.
  const devBuild = import.meta.env.DEV || !inTauri;
  return (
    <SettingRow label="Start at login, in the tray"
      hint={devBuild ? "Change this from the installed app. Development builds can't register themselves." : err ?? undefined}>
      <Switch label="Start at login" checked={on} disabled={devBuild}
        onChange={async (v) => {
          try { await autostart.set(v); setOn(v); setErr(null); }
          catch (e) { setErr("Couldn't change the login item."); console.error(e); }
        }} />
    </SettingRow>
  );
}

function TaskCleanup() {
  const { tasks, removeWhere } = useTasks();
  const [confirm, setConfirm] = useState(false);
  const done = tasks.filter((t) => t.completed).length;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <>
      <SettingRow label="Clear finished tasks" hint={done ? plural(done, "finished task") : "Nothing finished to clear."}>
        <button className="btn-outline" disabled={!done} onClick={() => removeWhere((t) => t.completed)}>Clear</button>
      </SettingRow>
      <SettingRow label="Delete every task" hint="Weekly repeats included.">
        {confirm ? (
          <span className="flex items-center gap-2">
            <button className="btn-text" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn-outline border-negative text-negative hover:bg-negative/10"
              onClick={() => { removeWhere(() => true); setConfirm(false); }}>
              Delete {plural(tasks.length, "task")}
            </button>
          </span>
        ) : (
          <button className="btn-outline text-negative" disabled={!tasks.length}
            onClick={() => { setConfirm(true); timer.current = window.setTimeout(() => setConfirm(false), 6000); }}>
            Delete all…
          </button>
        )}
      </SettingRow>
    </>
  );
}
