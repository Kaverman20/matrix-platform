import { describe, expect, it } from "vitest";
import { resolveBaseUrl } from "./resolveBaseUrl";

describe("resolveBaseUrl", () => {
  it("passes an explicit https url through unchanged", async () => {
    await expect(resolveBaseUrl("https://matrix.foxhound.run")).resolves.toBe(
      "https://matrix.foxhound.run",
    );
  });

  it("trims a trailing slash", async () => {
    await expect(resolveBaseUrl("https://matrix.foxhound.run/")).resolves.toBe(
      "https://matrix.foxhound.run",
    );
  });

  it("trims surrounding whitespace", async () => {
    await expect(resolveBaseUrl("  https://matrix.foxhound.run  ")).resolves.toBe(
      "https://matrix.foxhound.run",
    );
  });

  it("throws when the homeserver is empty", async () => {
    await expect(resolveBaseUrl("   ")).rejects.toThrow();
  });
});
