import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "./usePreferences";

const STORAGE_KEY = "surf-chat:preferences";
const LEGACY_VIEW_KEY = "surf-chat:view";

beforeEach(() => {
  localStorage.clear();
  // matchMedia is used by theme application; jsdom doesn't implement it.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePreferencesStore", () => {
  it("falls back to defaults when nothing is stored", () => {
    const { result } = renderHook(() => usePreferencesStore());
    expect(result.current.preferences).toMatchObject({
      theme: "light",
      defaultChatView: "flat",
      enterToSend: true,
      use24HourTime: false,
    });
  });

  it("merges stored values over defaults", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ use24HourTime: true, defaultChatView: "bubbles" }),
    );
    const { result } = renderHook(() => usePreferencesStore());
    expect(result.current.preferences.use24HourTime).toBe(true);
    expect(result.current.preferences.defaultChatView).toBe("bubbles");
    // Untouched keys keep their defaults.
    expect(result.current.preferences.enterToSend).toBe(true);
  });

  it("is resilient to malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const { result } = renderHook(() => usePreferencesStore());
    expect(result.current.preferences.theme).toBe("light");
  });

  it("normalizes an unknown stored theme back to light", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "neon-pink" }));
    const { result } = renderHook(() => usePreferencesStore());
    expect(result.current.preferences.theme).toBe("light");
  });

  it("migrates the legacy chat-view key once and removes it", () => {
    localStorage.setItem(LEGACY_VIEW_KEY, "bubbles");
    const { result } = renderHook(() => usePreferencesStore());
    expect(result.current.preferences.defaultChatView).toBe("bubbles");
    expect(localStorage.getItem(LEGACY_VIEW_KEY)).toBeNull();
  });

  it("persists changes to localStorage via setPreference", () => {
    const { result } = renderHook(() => usePreferencesStore());
    act(() => result.current.setPreference("enterToSend", false));
    expect(result.current.preferences.enterToSend).toBe(false);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.enterToSend).toBe(false);
  });

  it("restores defaults via resetToDefaults", () => {
    const { result } = renderHook(() => usePreferencesStore());
    act(() => result.current.setPreference("use24HourTime", true));
    act(() => result.current.resetToDefaults());
    expect(result.current.preferences.use24HourTime).toBe(false);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.use24HourTime).toBe(false);
  });
});
