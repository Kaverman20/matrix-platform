import { describe, expect, it } from "vitest";
import { isRemoteBuildNewer } from "./versionUpdate";

describe("isRemoteBuildNewer", () => {
  it("detects a changed build id", () => {
    expect(isRemoteBuildNewer("abc123", "def456")).toBe(true);
  });

  it("ignores identical or empty ids", () => {
    expect(isRemoteBuildNewer("abc123", "abc123")).toBe(false);
    expect(isRemoteBuildNewer("", "abc123")).toBe(false);
    expect(isRemoteBuildNewer("abc123", "")).toBe(false);
  });
});
