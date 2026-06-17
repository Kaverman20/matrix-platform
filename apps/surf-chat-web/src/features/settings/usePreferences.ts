import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatDisplayTime } from "@matrix-platform/matrix-core";
import {
  isDarkPreset,
  normalizeThemePreset,
  resolveThemePreset,
  type ResolvedThemePreset,
  type ThemePreset,
} from "./themePresets";

export type { ThemePreset };
export type ChatView = "flat" | "bubbles";

export type SurfPreferences = {
  theme: ThemePreset;
  defaultChatView: ChatView;
  enterToSend: boolean;
  use24HourTime: boolean;
  showTypingIndicator: boolean;
  showReadReceipts: boolean;
};

const STORAGE_KEY = "surf-chat:preferences";
const LEGACY_VIEW_KEY = "surf-chat:view";

const DEFAULTS: SurfPreferences = {
  theme: "light",
  defaultChatView: "flat",
  enterToSend: true,
  use24HourTime: false,
  showTypingIndicator: true,
  showReadReceipts: true,
};

/** Read prefs from localStorage, merging over defaults and folding in the old
 * `surf-chat:view` key once (then dropping it). Resilient to malformed JSON. */
function loadPreferences(): SurfPreferences {
  let stored: Partial<SurfPreferences> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<SurfPreferences>;
  } catch {
    stored = {};
  }

  const next: SurfPreferences = { ...DEFAULTS, ...stored, theme: normalizeThemePreset(stored.theme) };

  // One-time migration of the standalone chat-view key.
  if (stored.defaultChatView === undefined) {
    const legacy = localStorage.getItem(LEGACY_VIEW_KEY);
    if (legacy === "flat" || legacy === "bubbles") next.defaultChatView = legacy;
  }
  if (localStorage.getItem(LEGACY_VIEW_KEY) !== null) {
    localStorage.removeItem(LEGACY_VIEW_KEY);
  }

  return next;
}

function savePreferences(prefs: SurfPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full / disabled — preferences just won't persist this session.
  }
}

function shouldAnimateTheme(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains("reduce-motion")) return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type ColorScheme = "light" | "dark";

const LIGHT_REVEAL_MS = 1450;

function getCurrentResolvedPreset(): ResolvedThemePreset {
  const preset = document.documentElement.dataset.themePreset;
  if (
    preset === "light" ||
    preset === "pure-light" ||
    preset === "dark" ||
    preset === "magic-blue" ||
    preset === "classic-dark"
  ) {
    return preset;
  }
  if (document.documentElement.dataset.theme === "dark") return "dark";
  return "light";
}

function applyResolvedPreset(preset: ResolvedThemePreset) {
  document.documentElement.dataset.themePreset = preset;
  delete document.documentElement.dataset.theme;
}

/** Dark→light: crossfade + brightness ramp on the light snapshot (no pre-darkening). */
function revealLightTheme(update: () => void) {
  const html = document.documentElement;

  if ("startViewTransition" in document) {
    html.classList.add("theme-switch-to-light");
    const transition = document.startViewTransition(() => update());
    transition.finished.finally(() => html.classList.remove("theme-switch-to-light"));
    return;
  }

  update();
  html.style.filter = "brightness(0.58)";
  void html.getBoundingClientRect();
  html.style.transition = "filter 1.45s cubic-bezier(0.22, 1, 0.36, 1)";
  html.style.filter = "brightness(1)";

  const cleanup = () => {
    html.style.filter = "";
    html.style.transition = "";
  };
  html.addEventListener("transitionend", cleanup, { once: true });
  window.setTimeout(cleanup, LIGHT_REVEAL_MS + 100);
}

function runThemeUpdate(
  update: () => void,
  animate: boolean,
  from: ColorScheme,
  to: ColorScheme,
) {
  if (!animate || !shouldAnimateTheme()) {
    update();
    return;
  }

  if (from === "dark" && to === "light") {
    revealLightTheme(update);
    return;
  }

  const html = document.documentElement;

  if ("startViewTransition" in document) {
    document.startViewTransition(() => update());
    return;
  }

  html.classList.add("theme-crossfade");
  update();
  window.setTimeout(() => html.classList.remove("theme-crossfade"), 750);
}

/** Reflect the chosen preset onto <html data-theme-preset>. "system" follows the OS. */
export function applyTheme(preset: ThemePreset, options?: { animate?: boolean }) {
  const to = resolveThemePreset(preset);
  const from = getCurrentResolvedPreset();
  if (from === to) return;

  const fromScheme = isDarkPreset(from) ? "dark" : "light";
  const toScheme = isDarkPreset(to) ? "dark" : "light";

  runThemeUpdate(
    () => applyResolvedPreset(to),
    options?.animate ?? false,
    fromScheme,
    toScheme,
  );
}

/** Run once on startup before React mounts so there's no flash. */
export function initThemeFromStorage() {
  applyResolvedPreset(resolveThemePreset(loadPreferences().theme));
}

export type PreferencesStore = {
  preferences: SurfPreferences;
  setPreference: <K extends keyof SurfPreferences>(key: K, value: SurfPreferences[K]) => void;
  resetToDefaults: () => void;
};

/** Stateful store backing the provider: persists changes, applies the theme,
 * and re-applies on OS scheme changes while in "system" mode. */
export function usePreferencesStore(): PreferencesStore {
  const [preferences, setPreferences] = useState<SurfPreferences>(loadPreferences);

  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    if (preferences.theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preferences.theme]);

  const setPreference = useCallback(
    <K extends keyof SurfPreferences>(key: K, value: SurfPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        savePreferences(next);
        if (key === "theme") applyTheme(value as ThemePreset, { animate: true });
        return next;
      });
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULTS);
    savePreferences(DEFAULTS);
  }, []);

  return useMemo(
    () => ({ preferences, setPreference, resetToDefaults }),
    [preferences, setPreference, resetToDefaults],
  );
}

const PreferencesContext = createContext<PreferencesStore | null>(null);
export { PreferencesContext };

export function usePreferences(): PreferencesStore {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}

/** Formats a timestamp as HH:MM honouring the current 12/24-hour preference.
 * Re-derives reactively, so flipping the toggle updates times without reload. */
export function useTimeFormatter(): (timestamp: number) => string {
  const { preferences } = usePreferences();
  return useCallback(
    (timestamp: number) => formatDisplayTime(timestamp, { hour24: preferences.use24HourTime }),
    [preferences.use24HourTime],
  );
}
