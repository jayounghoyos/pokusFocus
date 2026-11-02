import { useCallback, useEffect, useState } from "react";

/**
 * Appearance: the focus hue (preset or any custom colour) and the background
 * tone. The hue colours focus time only — never buttons, tabs or nav.
 * Preset keys are kept from v0.2 so saved choices carry over.
 */
export type Theme = "crimson" | "mist" | "forest" | "plum" | "amber" | "slate" | "custom";
export type Ground = "warm" | "neutral" | "cool" | "black";
export type Mode = "dark" | "light" | "system";

export const THEMES: { key: Exclude<Theme, "custom">; label: string; swatch: string }[] = [
  { key: "crimson", label: "Tomato", swatch: "#ff6a4d" },
  { key: "amber",   label: "Amber",  swatch: "#f2b33d" },
  { key: "forest",  label: "Moss",   swatch: "#8fd45e" },
  { key: "mist",    label: "Sky",    swatch: "#4cb3f0" },
  { key: "plum",    label: "Rose",   swatch: "#f0709a" },
  { key: "slate",   label: "Chalk",  swatch: "#d9d6d0" },
];

/** Background tones. The fourth is pure black in dark mode, pure white in light. */
export const GROUNDS: {
  key: Ground;
  dark: { label: string; ground: string; surface: string };
  light: { label: string; ground: string; surface: string };
}[] = [
  { key: "warm",    dark: { label: "Warm", ground: "#0e0d0c", surface: "#181716" },    light: { label: "Warm", ground: "#f4f4f2", surface: "#ffffff" } },
  { key: "neutral", dark: { label: "Neutral", ground: "#0a0a0a", surface: "#151515" }, light: { label: "Neutral", ground: "#f6f6f6", surface: "#ffffff" } },
  { key: "cool",    dark: { label: "Cool", ground: "#0c0d0f", surface: "#15171a" },    light: { label: "Cool", ground: "#f5f7fa", surface: "#ffffff" } },
  { key: "black",   dark: { label: "Black", ground: "#000000", surface: "#111111" },   light: { label: "White", ground: "#ffffff", surface: "#f6f6f6" } },
];

export const MODES: { key: Mode; label: string }[] = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "system", label: "System" },
];

export interface Appearance {
  mode: Mode;
  theme: Theme;
  customHue: string;
  ground: Ground;
}

const KEYS = { theme: "pokusfocus.theme.v1", hue: "pokusfocus.hue.v1", ground: "pokusfocus.ground.v1", mode: "pokusfocus.mode.v1" };

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function loadAppearance(): Appearance {
  const t = read(KEYS.theme);
  const g = read(KEYS.ground);
  const m = read(KEYS.mode);
  return {
    mode: m === "light" || m === "system" ? m : "dark",
    theme: t === "custom" || THEMES.some((x) => x.key === t) ? (t as Theme) : "crimson",
    customHue: /^#[0-9a-f]{6}$/i.test(read(KEYS.hue) ?? "") ? read(KEYS.hue)! : "#ff6a4d",
    ground: GROUNDS.some((x) => x.key === g) ? (g as Ground) : "warm",
  };
}

export function hexToRgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** WCAG relative luminance of a #rrggbb colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgbTriplet(hex).split(" ").map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The hue currently in use, as hex. */
export function activeHue(a: Appearance): string {
  return a.theme === "custom" ? a.customHue : THEMES.find((t) => t.key === a.theme)!.swatch;
}

const systemQuery = () => window.matchMedia?.("(prefers-color-scheme: light)");

/** The mode actually shown: "system" resolves to the desktop's preference. */
export function resolvedMode(a: Appearance): "dark" | "light" {
  if (a.mode !== "system") return a.mode;
  return systemQuery()?.matches ? "light" : "dark";
}

export function applyAppearance(a: Appearance) {
  const root = document.documentElement;
  root.dataset.mode = resolvedMode(a);
  root.dataset.theme = a.theme;
  root.dataset.ground = a.ground;
  if (a.theme === "custom") root.style.setProperty("--hue", hexToRgbTriplet(a.customHue));
  else root.style.removeProperty("--hue");
}

export function useAppearance(): [Appearance, (patch: Partial<Appearance>) => void] {
  const [a, setA] = useState<Appearance>(loadAppearance);
  useEffect(() => {
    applyAppearance(a);
    if (a.mode !== "system") return;
    const q = systemQuery();
    const on = () => applyAppearance(a);
    q?.addEventListener("change", on);
    return () => q?.removeEventListener("change", on);
  }, [a]);
  const update = useCallback((patch: Partial<Appearance>) => {
    setA((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEYS.theme, next.theme);
        localStorage.setItem(KEYS.hue, next.customHue);
        localStorage.setItem(KEYS.ground, next.ground);
        localStorage.setItem(KEYS.mode, next.mode);
      } catch { /* blocked storage: still applies for this session */ }
      return next;
    });
  }, []);
  return [a, update];
}
