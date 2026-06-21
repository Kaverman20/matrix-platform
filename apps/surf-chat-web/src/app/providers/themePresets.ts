export type ThemePreset = "system" | "light" | "pure-light" | "dark" | "magic-blue" | "classic-dark";
export type ResolvedThemePreset = Exclude<ThemePreset, "system">;

export const THEME_PRESET_VALUES: readonly ThemePreset[] = [
  "system",
  "light",
  "pure-light",
  "dark",
  "magic-blue",
  "classic-dark",
];

export type ThemePreview = {
  bg: string;
  text: string;
  dot?: string;
};

export const THEME_PRESETS: { value: ThemePreset; label: string; preview: ThemePreview }[] = [
  {
    value: "system",
    label: "Как в системе",
    preview: { bg: "#f0f0f2", text: "#2b2e34" },
  },
  {
    value: "light",
    label: "Светлая",
    preview: { bg: "#fdfcfa", text: "#2b2e34" },
  },
  {
    value: "pure-light",
    label: "Чистая светлая",
    preview: { bg: "#ffffff", text: "#2b2e34" },
  },
  {
    value: "dark",
    label: "Тёмная",
    preview: { bg: "#1a1c20", text: "#e6e7ea" },
  },
  {
    value: "magic-blue",
    label: "Magic Blue",
    preview: { bg: "#171a22", text: "#e8eaed", dot: "#6b7fff" },
  },
  {
    value: "classic-dark",
    label: "Classic Dark",
    preview: { bg: "#1a1a1a", text: "#ececec" },
  },
];

export function themePresetLabel(value: ThemePreset): string {
  return THEME_PRESETS.find((p) => p.value === value)?.label ?? value;
}

export function isDarkPreset(preset: ResolvedThemePreset): boolean {
  return preset === "dark" || preset === "magic-blue" || preset === "classic-dark";
}

export function prefersDarkOs(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function resolveThemePreset(preset: ThemePreset): ResolvedThemePreset {
  if (preset === "system") return prefersDarkOs() ? "dark" : "light";
  return preset;
}

export function normalizeThemePreset(value: unknown): ThemePreset {
  if (typeof value === "string" && THEME_PRESET_VALUES.includes(value as ThemePreset)) {
    return value as ThemePreset;
  }
  return "light";
}
