import { useEffect, useState } from "react";

export type Theme =
  | "crimson"
  | "mist"
  | "forest"
  | "plum"
  | "amber"
  | "slate";

export const THEMES: { key: Theme; label: string; swatch: string }[] = [
  { key: "crimson", label: "Crimson", swatch: "#dc2626" },
  { key: "mist",    label: "Mist",    swatch: "#60a5fa" },
  { key: "forest",  label: "Forest",  swatch: "#10b981" },
  { key: "plum",    label: "Plum",    swatch: "#a855f7" },
  { key: "amber",   label: "Amber",   swatch: "#f59e0b" },
  { key: "slate",   label: "Slate",   swatch: "#a1a1aa" },
];

const STORAGE_KEY = "pokusfocus.theme.v1";

export function loadTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.some((t) => t.key === stored)) {
    return stored as Theme;
  }
  return "crimson";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };
  return [theme, setTheme];
}
