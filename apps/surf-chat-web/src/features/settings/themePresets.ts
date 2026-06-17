import type { ThemeMode } from "./usePreferences";

export type ThemePreview =
  | { type: "solid"; bg: string; text: string }
  | {
      type: "system";
      light: { bg: string; text: string };
      dark: { bg: string; text: string };
    };

/** Static swatch colors — mirror tokens.css / tokens-dark.css for picker previews. */
export const THEME_PRESETS: { value: ThemeMode; label: string; preview: ThemePreview }[] = [
  {
    value: "system",
    label: "Системная",
    preview: {
      type: "system",
      light: { bg: "#fdfcfa", text: "#2b2e34" },
      dark: { bg: "#1a1c20", text: "#e6e7ea" },
    },
  },
  {
    value: "light",
    label: "Светлая",
    preview: { type: "solid", bg: "#fdfcfa", text: "#2b2e34" },
  },
  {
    value: "dark",
    label: "Тёмная",
    preview: { type: "solid", bg: "#1a1c20", text: "#e6e7ea" },
  },
];

export function themePresetLabel(value: ThemeMode): string {
  return THEME_PRESETS.find((p) => p.value === value)?.label ?? value;
}
