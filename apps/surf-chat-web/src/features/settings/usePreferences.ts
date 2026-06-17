import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatDisplayTime } from "@matrix-platform/matrix-core";

export type ThemeMode = "light" | "dark" | "system";
export type ChatView = "flat" | "bubbles";

export type SurfPreferences = {
  theme: ThemeMode;
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

  const next: SurfPreferences = { ...DEFAULTS, ...stored };

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

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Reflect the chosen theme onto <html data-theme>. "system" follows the OS. */
export function applyTheme(theme: ThemeMode) {
  const effective = theme === "system" ? (prefersDark() ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = effective;
}

/** Run once on startup before React mounts so there's no light→dark flash. */
export function initThemeFromStorage() {
  applyTheme(loadPreferences().theme);
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
