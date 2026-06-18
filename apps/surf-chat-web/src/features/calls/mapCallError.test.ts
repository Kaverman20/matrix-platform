import { describe, expect, it } from "vitest";
import { mapCallError } from "./mapCallError";

describe("mapCallError", () => {
  it("maps LiveKit signal timeout to a friendly message", () => {
    expect(
      mapCallError(new Error("could not establish signal connection: room connection has timed out (signal)")),
    ).toBe("Не удалось установить соединение");
  });

  it("maps microphone permission errors", () => {
    expect(mapCallError(new Error("Permission denied NotAllowedError"))).toBe(
      "Нет доступа к микрофону",
    );
  });

  it("passes through lk-jwt errors", () => {
    expect(mapCallError(new Error("lk-jwt: Failed to look up user"))).toBe(
      "lk-jwt: Failed to look up user",
    );
  });
});
