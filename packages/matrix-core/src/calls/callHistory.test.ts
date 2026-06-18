import { describe, expect, it } from "vitest";
import { CALL_SUMMARY_KEY, formatCallSummaryLine, parseCallSummary } from "./callHistory";

describe("parseCallSummary", () => {
  it("returns null without the marker", () => {
    expect(parseCallSummary({ body: "hi" })).toBeNull();
  });

  it("parses the marker into seconds", () => {
    const content = { [CALL_SUMMARY_KEY]: { answered: true, duration_ms: 154000, intent: "audio" } };
    expect(parseCallSummary(content)).toEqual({
      answered: true,
      durationSec: 154,
      intent: "audio",
      busy: false,
    });
  });
});

describe("formatCallSummaryLine", () => {
  it("answered, from the caller's view", () => {
    const line = formatCallSummaryLine({ answered: true, durationSec: 154, intent: "audio" }, true);
    expect(line).toBe("📞 Исходящий звонок · 2:34");
  });

  it("answered, from the callee's view", () => {
    const line = formatCallSummaryLine({ answered: true, durationSec: 65, intent: "video" }, false);
    expect(line).toBe("📹 Входящий звонок · 1:05");
  });

  it("missed for the callee, cancelled for the caller", () => {
    const missed = { answered: false, durationSec: 0, intent: "audio" } as const;
    expect(formatCallSummaryLine(missed, false)).toBe("📞 Пропущенный звонок");
    expect(formatCallSummaryLine(missed, true)).toBe("📞 Отменённый звонок");
  });

  it("busy for the caller", () => {
    const busy = { answered: false, durationSec: 0, intent: "audio", busy: true } as const;
    expect(formatCallSummaryLine(busy, true)).toBe("📞 Занят");
    expect(formatCallSummaryLine(busy, false)).toBe("📞 Пропущенный звонок");
  });
});
