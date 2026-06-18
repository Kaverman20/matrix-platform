import { describe, expect, it } from "vitest";
import { formatDisplayTime, formatRoomListTime } from "./formatTime";

const DAY = 86_400_000;

describe("formatDisplayTime", () => {
  it("returns empty for invalid timestamps", () => {
    expect(formatDisplayTime(0)).toBe("");
    expect(formatDisplayTime(NaN)).toBe("");
    expect(formatDisplayTime(Infinity)).toBe("");
  });
});

describe("formatRoomListTime", () => {
  const now = new Date(2026, 5, 17, 15, 30).getTime();

  it("returns empty for invalid timestamps", () => {
    expect(formatRoomListTime(0, { now })).toBe("");
    expect(formatRoomListTime(NaN, { now })).toBe("");
  });

  it("shows clock time for messages from today", () => {
    const todayMorning = new Date(2026, 5, 17, 9, 15).getTime();
    const formatted = formatRoomListTime(todayMorning, { now, hour24: true });
    expect(formatted).toMatch(/09:15/);
  });

  it("shows yesterday label", () => {
    const yesterday = now - DAY;
    expect(formatRoomListTime(yesterday, { now })).toBe("Вчера");
  });

  it("shows weekday for messages within the last week", () => {
    const threeDaysAgo = now - 3 * DAY;
    const formatted = formatRoomListTime(threeDaysAgo, { now, locale: "ru-RU" });
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).not.toBe("Вчера");
  });

  it("shows month and day for older messages in the same year", () => {
    const older = Date.UTC(2026, 0, 10, 12, 0);
    const formatted = formatRoomListTime(older, { now, locale: "ru-RU" });
    expect(formatted).toMatch(/10/);
  });
});
