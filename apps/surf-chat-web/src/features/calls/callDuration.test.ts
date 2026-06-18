import { describe, expect, it } from "vitest";
import { formatCallDuration } from "./callDuration";

describe("formatCallDuration", () => {
  it("formats sub-minute as M:SS", () => {
    expect(formatCallDuration(0)).toBe("0:00");
    expect(formatCallDuration(5)).toBe("0:05");
  });

  it("formats minutes and seconds", () => {
    expect(formatCallDuration(65)).toBe("1:05");
    expect(formatCallDuration(600)).toBe("10:00");
  });

  it("adds hours past 60 minutes", () => {
    expect(formatCallDuration(3661)).toBe("1:01:01");
  });

  it("clamps negatives and floors fractions", () => {
    expect(formatCallDuration(-5)).toBe("0:00");
    expect(formatCallDuration(9.9)).toBe("0:09");
  });
});
