import { describe, expect, it } from "vitest";
import { isSearchShortcut } from "./searchShortcut";

describe("isSearchShortcut", () => {
  it("matches Cmd+K and Ctrl+K", () => {
    expect(isSearchShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isSearchShortcut({ key: "K", metaKey: false, ctrlKey: true })).toBe(true);
  });

  it("ignores plain k", () => {
    expect(isSearchShortcut({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
  });
});
