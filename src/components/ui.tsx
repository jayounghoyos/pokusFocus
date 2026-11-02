import { ReactNode, SVGProps, useEffect, useState } from "react";
import clsx from "clsx";

/* ---------- Icons: one outline set, 16px, 1.5 stroke, grey by default ---------- */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}
export const Icon = {
  Today: (p: IconProps) => <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></Svg>,
  Week: (p: IconProps) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>,
  Settings: (p: IconProps) => <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>,
  Play: (p: IconProps) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" /></Svg>,
  Pause: (p: IconProps) => <Svg {...p}><path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth="2.5" /></Svg>,
  Skip: (p: IconProps) => <Svg {...p}><path d="M6 6l8 6-8 6zM18 6v12" /></Svg>,
  Reset: (p: IconProps) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></Svg>,
  Repeat: (p: IconProps) => <Svg {...p}><path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" /></Svg>,
  Plus: (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  Close: (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>,
  Left: (p: IconProps) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>,
  Right: (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>,
  Down: (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>,
  Expand: (p: IconProps) => <Svg {...p}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></Svg>,
  Notes: (p: IconProps) => <Svg {...p}><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" /></Svg>,
  Grip: (p: IconProps) => <Svg {...p} strokeWidth="2.5"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" /></Svg>,
};

/* ---------- The product mark: a timer ring with the focus arc in the data hue ---------- */

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgb(var(--raised))" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="rgb(var(--hue))" strokeWidth="3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="rgb(var(--ink))" />
    </svg>
  );
}

/* ---------- Check: inverted when on (white box, black tick) — never the hue ---------- */

export function Check({ checked, onChange, size = 18, label }: {
  checked: boolean; onChange: (v: boolean) => void; size?: number; label: string;
}) {
  return (
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{ width: size, height: size }}
      className={clsx(
        "flex-none inline-flex items-center justify-center rounded-[6px] border transition-colors duration-150",
        checked ? "bg-invert border-invert text-on-invert" : "border-control hover:border-muted",
      )}
    >
      {checked && (
        <svg viewBox="0 0 14 14" width={size * 0.7} height={size * 0.7} fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="3 7 6 10 11 4" />
        </svg>
      )}
    </button>
  );
}

/* ---------- Switch: 32x18, white when on ---------- */

export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-[18px] w-8 flex-none items-center rounded-full transition-colors duration-150",
        "disabled:opacity-40",
        checked ? "bg-invert" : "bg-raised",
      )}
    >
      <span className={clsx(
        "inline-block h-3.5 w-3.5 rounded-full transition-transform duration-150",
        checked ? "translate-x-4 bg-on-invert" : "translate-x-0.5 bg-muted",
      )} />
    </button>
  );
}

/* ---------- Stepper: − value + ---------- */

export function Stepper({ value, min, max, step = 1, onChange, label, unit, disabled }: {
  value: number; min: number; max: number; step?: number; onChange: (n: number) => void;
  label: string; unit?: string; disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className={clsx("inline-flex flex-none items-center rounded-full bg-raised", disabled && "opacity-40")}
      style={{ height: "var(--control-h)" }}>
      <button type="button" className="h-full w-9 rounded-l-full text-muted hover:text-ink disabled:opacity-30"
        disabled={disabled || value <= min} onClick={() => onChange(clamp(value - step))}
        aria-label={`Decrease ${label}`}>−</button>
      <span className="num min-w-[52px] text-center text-sm text-ink" aria-live="polite">
        {value}{unit && <span className="text-faint"> {unit}</span>}
      </span>
      <button type="button" className="h-full w-9 rounded-r-full text-muted hover:text-ink disabled:opacity-30"
        disabled={disabled || value >= max} onClick={() => onChange(clamp(value + step))}
        aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

/* ---------- Dialog shell: the one place a shadow is allowed (it floats) ---------- */

export function Dialog({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-rise"
      onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={clsx("flex max-h-[90vh] w-full flex-col rounded-[20px] bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-pop",
          wide ? "max-w-3xl" : "max-w-md")}
        onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-[22px] pt-[18px] pb-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-[22px]">{children}</div>
        {footer && <footer className="flex items-center justify-between gap-3 border-t border-line px-[22px] py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- ColorPicker: presets, any custom colour, and its hex ---------- */

export function ColorPicker({ value, presets, onChange, label, size = 24 }: {
  value: string; presets: { color: string; name: string }[]; onChange: (hex: string) => void;
  label: string; size?: number;
}) {
  const v = value.toLowerCase();
  const isCustom = !presets.some((p) => p.color.toLowerCase() === v);
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const ring = "ring-offset-2 ring-offset-surface transition-transform duration-150";
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      {presets.map((p) => (
        <button key={p.color} type="button" role="radio" aria-checked={p.color.toLowerCase() === v}
          aria-label={p.name} title={p.name} onClick={() => onChange(p.color)}
          className={clsx("flex-none rounded-full", ring, p.color.toLowerCase() === v ? "ring-2 ring-ink" : "hover:scale-110")}
          style={{ width: size, height: size, backgroundColor: p.color }} />
      ))}
      <label title="Any colour" className={clsx("relative flex flex-none cursor-pointer items-center justify-center rounded-full border border-dashed border-control text-muted hover:text-ink",
        ring, isCustom && "border-solid border-transparent ring-2 ring-ink")}
        style={{ width: size, height: size, backgroundColor: isCustom ? value : undefined }}>
        {!isCustom && <Icon.Plus size={Math.round(size * 0.55)} />}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`${label}: any colour`} />
      </label>
      <input value={hex} spellCheck={false} aria-label={`${label}: hex code`}
        onChange={(e) => {
          const t = e.target.value.trim();
          setHex(t);
          const full = /^#?[0-9a-f]{6}$/i.test(t) ? (t.startsWith("#") ? t : `#${t}`) : null;
          if (full) onChange(full.toLowerCase());
        }}
        className="num h-7 w-[84px] rounded-full border border-control bg-ground px-2.5 text-xs text-ink focus:border-muted focus:outline-none" />
    </div>
  );
}
